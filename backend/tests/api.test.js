const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { resetDatabase, createUser, db } = require('./helpers');
const app = require('../app');

const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
const SECRET = process.env.SIMULATOR_SECRET;
const DEST = 'Senate Building';

const admin = request.agent(app);
const driver = request.agent(app);
const other = request.agent(app);
let driverId, otherId, vehicleId, tripId;

const login = (agent, email, password) => agent.post('/api/auth/login').set(XHR).send({ email, password });

test.before(async () => {
    await resetDatabase();
    await createUser('Admin', 'admin@test.ng', 'Admin#1234', 'Admin');
    driverId = await createUser('Driver One', 'd1@test.ng', 'Driver#1234', 'Driver');
    otherId = await createUser('Driver Two', 'd2@test.ng', 'Driver#1234', 'Driver');
});
test.after(async () => { await db.end(); });

test('health check', async () => {
    const r = await request(app).get('/api/health');
    assert.equal(r.status, 200);
});

test('authentication: rejects bad credentials, requires XHR header, sets HttpOnly cookie, restores session', async () => {
    assert.equal((await login(request(app), 'admin@test.ng', 'wrong')).status, 401);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'admin@test.ng', password: 'Admin#1234' })).status, 403); // no header
    const ok = await login(admin, 'admin@test.ng', 'Admin#1234');
    assert.equal(ok.status, 200);
    assert.match(ok.headers['set-cookie'][0], /HttpOnly/);
    assert.match(ok.headers['set-cookie'][0], /SameSite=Strict/);
    assert.equal(ok.body.user.role, 'Admin');
    assert.equal((await admin.get('/api/auth/session')).body.user.email, 'admin@test.ng');
    assert.equal((await login(driver, 'd1@test.ng', 'Driver#1234')).status, 200);
    assert.equal((await login(other, 'd2@test.ng', 'Driver#1234')).status, 200);
});

test('authorization: anonymous gets 401, drivers get 403 on admin routes', async () => {
    assert.equal((await request(app).get('/api/vehicles')).status, 401);
    assert.equal((await driver.get('/api/vehicles')).status, 403);
    assert.equal((await driver.get('/api/drivers')).status, 403);
    assert.equal((await driver.get('/api/maintenance/alerts')).status, 403);
    assert.equal((await admin.get('/api/trips/my-trips')).status, 403);
});

test('vehicles: validation, duplicate plate, next service due', async () => {
    assert.equal((await admin.post('/api/vehicles').set(XHR).send({ plate_number: 'X', model: 'M', service_interval_km: 0 })).status, 400);
    assert.equal((await admin.post('/api/vehicles').set(XHR).send({ plate_number: 'X', model: 'M', initial_odometer: -5 })).status, 400);
    const r = await admin.post('/api/vehicles').set(XHR).send({ plate_number: 'abu-1', model: 'Hiace', initial_odometer: 40000, service_interval_km: 5000 });
    assert.equal(r.status, 201);
    vehicleId = r.body.vehicle_id;
    assert.equal(r.body.plate_number, 'ABU-1');
    assert.equal(r.body.next_service_due, 45000);
    assert.equal((await admin.post('/api/vehicles').set(XHR).send({ plate_number: 'ABU-1', model: 'Dup' })).status, 409);
});

test('drivers: create, duplicate email, list', async () => {
    assert.equal((await admin.post('/api/drivers').set(XHR).send({ name: 'N', email: 'bad', password: 'password1' })).status, 400);
    assert.equal((await admin.post('/api/drivers').set(XHR).send({ name: 'N', email: 'n@test.ng', password: 'short' })).status, 400);
    assert.equal((await admin.post('/api/drivers').set(XHR).send({ name: 'Dup', email: 'd1@test.ng', password: 'password1' })).status, 409);
    const list = await admin.get('/api/drivers');
    assert.equal(list.body.length, 2);
    assert.ok(!('password_hash' in list.body[0]));
});

test('trip lifecycle: create, approve, start with state and ownership checks', async () => {
    assert.equal((await admin.post('/api/trips').set(XHR).send({ vehicle_id: vehicleId, driver_id: driverId, destination: 'Nowhere' })).status, 400);
    const c = await admin.post('/api/trips').set(XHR).send({ vehicle_id: vehicleId, driver_id: driverId, destination: DEST });
    assert.equal(c.status, 201);
    assert.equal(c.body.status, 'Pending');
    tripId = c.body.trip_id;

    assert.equal((await driver.put(`/api/trips/${tripId}/start`).set(XHR)).status, 409); // not approved yet
    assert.equal((await driver.put(`/api/trips/${tripId}/approve`).set(XHR)).status, 403); // driver cannot approve
    assert.equal((await admin.put(`/api/trips/${tripId}/approve`).set(XHR)).status, 200);
    assert.equal((await admin.put(`/api/trips/${tripId}/approve`).set(XHR)).status, 409); // already approved
    assert.equal((await other.put(`/api/trips/${tripId}/start`).set(XHR)).status, 403); // someone else's trip

    const s = await driver.put(`/api/trips/${tripId}/start`).set(XHR);
    assert.equal(s.status, 200);
    assert.equal(s.body.status, 'Active');
    assert.equal(s.body.start_odometer, 40000);
    const veh = (await admin.get('/api/vehicles')).body.find((x) => x.vehicle_id === vehicleId);
    assert.equal(veh.status, 'In Trip');

    // a vehicle that is on a trip cannot be assigned again, deactivated, or put in maintenance
    assert.equal((await admin.post('/api/trips').set(XHR).send({ vehicle_id: vehicleId, driver_id: otherId, destination: DEST })).status, 409);
    assert.equal((await admin.delete(`/api/vehicles/${vehicleId}`).set(XHR)).status, 409);
    assert.equal((await admin.put(`/api/vehicles/${vehicleId}/status`).set(XHR).send({ status: 'Maintenance' })).status, 409);
    assert.equal((await admin.delete(`/api/drivers/${driverId}`).set(XHR)).status, 409);
});

test('telemetry: secret required, validated, only for Active trips, broadcast-ready', async () => {
    const body = { trip_id: tripId, latitude: 11.15, longitude: 7.65 };
    assert.equal((await request(app).post('/api/tracking/location').send(body)).status, 403);
    assert.equal((await request(app).post('/api/tracking/location').set('X-Simulator-Secret', 'wrong').send(body)).status, 403);
    assert.equal((await request(app).post('/api/tracking/location').set('X-Simulator-Secret', SECRET).send({ ...body, latitude: 999 })).status, 400);
    assert.equal((await request(app).post('/api/tracking/location').set('X-Simulator-Secret', SECRET).send({ ...body, trip_id: 99999 })).status, 404);
    const ok = await request(app).post('/api/tracking/location').set('X-Simulator-Secret', SECRET).send(body);
    assert.equal(ok.status, 201);

    const sim = await request(app).get('/api/tracking/simulator/trips').set('X-Simulator-Secret', SECRET);
    assert.equal(sim.body.length, 1);
    assert.ok(sim.body[0].destination_coords.lat);

    const active = await admin.get('/api/tracking/active');
    assert.equal(active.body.length, 1);
    assert.deepEqual(active.body[0].path, [[11.15, 7.65]]);
    const hist = await admin.get(`/api/tracking/history/${tripId}`);
    assert.equal(hist.body.points.length, 1);
});

test('trip completion: mileage integrity lock, atomic update, Warning alert', async () => {
    assert.equal((await driver.put(`/api/trips/${tripId}/complete`).set(XHR).send({})).status, 400);
    assert.equal((await driver.put(`/api/trips/${tripId}/complete`).set(XHR).send({ final_odometer: 39000 })).status, 400);
    assert.equal((await other.put(`/api/trips/${tripId}/complete`).set(XHR).send({ final_odometer: 44600 })).status, 403);
    // after the rejected attempts nothing has changed
    let veh = (await admin.get('/api/vehicles')).body.find((x) => x.vehicle_id === vehicleId);
    assert.equal(veh.current_odometer, 40000);
    assert.equal(veh.status, 'In Trip');

    const done = await driver.put(`/api/trips/${tripId}/complete`).set(XHR).send({ final_odometer: 44600 });
    assert.equal(done.status, 200);
    assert.equal(done.body.status, 'Completed');
    assert.equal(done.body.maintenance_alert, 'Warning');
    veh = (await admin.get('/api/vehicles')).body.find((x) => x.vehicle_id === vehicleId);
    assert.equal(veh.current_odometer, 44600);
    assert.equal(veh.status, 'Available');
    assert.equal(veh.active_alert, 'Warning');

    // completing twice is rejected; telemetry for a completed trip is rejected
    assert.equal((await driver.put(`/api/trips/${tripId}/complete`).set(XHR).send({ final_odometer: 44700 })).status, 409);
    assert.equal((await request(app).post('/api/tracking/location').set('X-Simulator-Secret', SECRET).send({ trip_id: tripId, latitude: 11.1, longitude: 7.6 })).status, 409);

    const alerts = await admin.get('/api/maintenance/alerts');
    assert.equal(alerts.body.length, 1);
    assert.equal(alerts.body[0].alert_level, 'Warning');
    assert.equal(alerts.body[0].next_service_due, 45000);
});

test('second trip escalates the Warning to a single Overdue alert; service log resolves it', async () => {
    const c = await admin.post('/api/trips').set(XHR).send({ vehicle_id: vehicleId, driver_id: driverId, destination: DEST });
    const id = c.body.trip_id;
    await admin.put(`/api/trips/${id}/approve`).set(XHR);
    await driver.put(`/api/trips/${id}/start`).set(XHR);
    assert.equal((await driver.put(`/api/trips/${id}/complete`).set(XHR).send({ final_odometer: 44000 })).status, 400); // below current
    assert.equal((await driver.put(`/api/trips/${id}/complete`).set(XHR).send({ final_odometer: 45100 })).body.maintenance_alert, 'Overdue');

    const alerts = await admin.get('/api/maintenance/alerts');
    assert.equal(alerts.body.length, 1);
    assert.equal(alerts.body[0].alert_level, 'Overdue');

    // service log validation
    assert.equal((await admin.post('/api/maintenance/service').set(XHR).send({ vehicle_id: vehicleId, service_date: '2999-01-01', odometer_at_service: 45100 })).status, 400);
    assert.equal((await admin.post('/api/maintenance/service').set(XHR).send({ vehicle_id: vehicleId, service_date: '2025-01-01', odometer_at_service: 99999 })).status, 400);
    const today = new Date().toISOString().slice(0, 10);
    const svc = await admin.post('/api/maintenance/service').set(XHR).send({ vehicle_id: vehicleId, service_date: today, odometer_at_service: 45100, details: 'Full service' });
    assert.equal(svc.status, 201);
    assert.equal(svc.body.next_service_due, 50100);
    assert.equal((await admin.get('/api/maintenance/alerts')).body.length, 0);
    const hist = await admin.get(`/api/maintenance/service/${vehicleId}`);
    assert.equal(hist.body.length, 1);
    assert.equal(hist.body[0].details, 'Full service');
});

test('cancel and abort', async () => {
    const mk = async () => (await admin.post('/api/trips').set(XHR).send({ vehicle_id: vehicleId, driver_id: driverId, destination: DEST })).body.trip_id;
    const t1 = await mk();
    assert.equal((await admin.put(`/api/trips/${t1}/terminate`).set(XHR)).status, 409); // not active
    assert.equal((await admin.put(`/api/trips/${t1}/cancel`).set(XHR)).body.status, 'Cancelled');
    assert.equal((await admin.put(`/api/trips/${t1}/cancel`).set(XHR)).status, 409);

    const t2 = await mk();
    await admin.put(`/api/trips/${t2}/approve`).set(XHR);
    await driver.put(`/api/trips/${t2}/start`).set(XHR);
    assert.equal((await admin.put(`/api/trips/${t2}/cancel`).set(XHR)).status, 409); // active trips use abort
    const t = await admin.put(`/api/trips/${t2}/terminate`).set(XHR);
    assert.equal(t.body.status, 'Cancelled');
    const veh = (await admin.get('/api/vehicles')).body.find((x) => x.vehicle_id === vehicleId);
    assert.equal(veh.status, 'Available');
    assert.equal(veh.current_odometer, 45100); // unchanged
});

test('manual maintenance status blocks assignment; deactivation hides the vehicle', async () => {
    assert.equal((await admin.put(`/api/vehicles/${vehicleId}/status`).set(XHR).send({ status: 'Maintenance' })).body.status, 'Maintenance');
    assert.equal((await admin.post('/api/trips').set(XHR).send({ vehicle_id: vehicleId, driver_id: driverId, destination: DEST })).status, 409);
    await admin.put(`/api/vehicles/${vehicleId}/status`).set(XHR).send({ status: 'Available' });

    // changing the interval re-evaluates the alert: 5,000 km since 45,100 -> shrink the interval to trigger Overdue
    assert.equal((await admin.put(`/api/vehicles/${vehicleId}`).set(XHR).send({ service_interval_km: 0 })).status, 400);

    assert.equal((await admin.delete(`/api/vehicles/${vehicleId}`).set(XHR)).status, 200);
    assert.equal((await admin.get('/api/vehicles')).body.length, 0);
    assert.equal((await admin.delete(`/api/vehicles/${vehicleId}`).set(XHR)).status, 404);
});

test('driver deactivation, dashboard summary, logout', async () => {
    assert.equal((await admin.delete(`/api/drivers/${otherId}`).set(XHR)).status, 200);
    // the deactivated driver's existing cookie stops working immediately
    assert.equal((await other.get('/api/trips/my-trips')).status, 401);
    assert.equal((await login(request(app), 'd2@test.ng', 'Driver#1234')).status, 403);

    const s = (await admin.get('/api/dashboard/summary')).body;
    assert.equal(s.vehicles.total, 0);
    assert.equal(s.drivers.total, 1);
    assert.ok(s.trips.completed >= 2);

    assert.equal((await admin.post('/api/auth/logout').set(XHR)).status, 200);
    assert.equal((await admin.get('/api/auth/session')).status, 401);
});

test('concurrency: two drivers cannot start trips on the same vehicle at once', async () => {
    await login(admin, 'admin@test.ng', 'Admin#1234'); // the previous test logged out
    const a = request.agent(app); const b = request.agent(app);
    const d3 = await createUser('Driver Three', 'd3@test.ng', 'Driver#1234', 'Driver');
    const d4 = await createUser('Driver Four', 'd4@test.ng', 'Driver#1234', 'Driver');
    await login(a, 'd3@test.ng', 'Driver#1234'); await login(b, 'd4@test.ng', 'Driver#1234');
    const veh = (await admin.post('/api/vehicles').set(XHR).send({ plate_number: 'RACE-1', model: 'Race', initial_odometer: 100 })).body.vehicle_id;
    const t1 = (await admin.post('/api/trips').set(XHR).send({ vehicle_id: veh, driver_id: d3, destination: DEST })).body.trip_id;
    const t2 = (await admin.post('/api/trips').set(XHR).send({ vehicle_id: veh, driver_id: d4, destination: DEST })).body.trip_id;
    assert.equal((await admin.put(`/api/trips/${t1}/approve`).set(XHR)).status, 200);
    assert.equal((await admin.put(`/api/trips/${t2}/approve`).set(XHR)).status, 200);
    const [r1, r2] = await Promise.all([a.put(`/api/trips/${t1}/start`).set(XHR), b.put(`/api/trips/${t2}/start`).set(XHR)]);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
    const [rows] = await db.query("SELECT COUNT(*) AS n FROM trips WHERE vehicle_id = ? AND status = 'Active'", [veh]);
    assert.equal(rows[0].n, 1);
});

test('changing the service interval re-evaluates the alert', async () => {
    await login(admin, 'admin@test.ng', 'Admin#1234');
    const veh = (await admin.post('/api/vehicles').set(XHR).send({ plate_number: 'INT-1', model: 'Interval', initial_odometer: 0, service_interval_km: 5000 })).body.vehicle_id;
    await db.query('UPDATE vehicles SET current_odometer = 4000 WHERE vehicle_id = ?', [veh]);
    assert.equal((await admin.put(`/api/vehicles/${veh}`).set(XHR).send({ service_interval_km: 3000 })).body.active_alert, 'Overdue');
    assert.equal((await admin.put(`/api/vehicles/${veh}`).set(XHR).send({ service_interval_km: 4400 })).body.active_alert, 'Warning');
    assert.equal((await admin.put(`/api/vehicles/${veh}`).set(XHR).send({ service_interval_km: 10000 })).body.active_alert, null);
    assert.equal((await admin.get('/api/maintenance/alerts')).body.filter((x) => x.vehicle_id === veh).length, 0);
});
