const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const request = require('supertest');
const { io: connect } = require('socket.io-client');
const { resetDatabase, createUser, db } = require('./helpers');
const app = require('../app');
const { initSocket } = require('../socket');

const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
let server, ioServer, url, adminCookie, driverCookie;

async function cookieFor(email, password) {
    const r = await request(app).post('/api/auth/login').set(XHR).send({ email, password });
    return r.headers['set-cookie'][0].split(';')[0];
}
const open = (cookie) => connect(url, { transports: ['websocket'], reconnection: false, extraHeaders: cookie ? { cookie } : {} });
const outcome = (socket) => new Promise((resolve) => {
    socket.on('connect', () => resolve('connected'));
    socket.on('connect_error', (e) => resolve(e.message));
});

test.before(async () => {
    await resetDatabase();
    await createUser('Admin', 'admin@test.ng', 'Admin#1234', 'Admin');
    await createUser('Driver', 'd1@test.ng', 'Driver#1234', 'Driver');
    adminCookie = await cookieFor('admin@test.ng', 'Admin#1234');
    driverCookie = await cookieFor('d1@test.ng', 'Driver#1234');
    server = http.createServer(app);
    ioServer = initSocket(server, app);
    await new Promise((r) => server.listen(0, r));
    url = `http://localhost:${server.address().port}`;
});
test.after(async () => { ioServer.close(); await db.end(); });

test('socket: anonymous and driver connections are rejected, administrators receive live events', async () => {
    const anon = open(); assert.equal(await outcome(anon), 'unauthorized'); anon.close();
    const drv = open(driverCookie); assert.equal(await outcome(drv), 'unauthorized'); drv.close();

    const adm = open(adminCookie);
    assert.equal(await outcome(adm), 'connected');
    const received = new Promise((resolve) => adm.on('vehicle_location_update', resolve));
    ioServer.to('admins').emit('vehicle_location_update', { trip_id: 1, latitude: 11.1, longitude: 7.6 });
    assert.deepEqual(await received, { trip_id: 1, latitude: 11.1, longitude: 7.6 });
    adm.close();
});
