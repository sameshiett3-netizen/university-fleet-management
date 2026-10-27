const db = require('../config/db');
const { LOCATIONS } = require('../config/locations');
const { HttpError } = require('../utils/errors');
const { withTransaction } = require('../utils/tx');
const { evaluateMaintenance } = require('../utils/maintenanceEngine');
const { emitToAdmins } = require('../utils/realtime');
const v = require('../utils/validate');

const TRIP_SELECT = `
    SELECT t.trip_id, t.vehicle_id, t.driver_id, t.destination, t.status, t.start_time, t.end_time,
           t.start_odometer, t.final_odometer, t.created_at,
           veh.plate_number, veh.model, u.name AS driver_name
    FROM trips t
    JOIN vehicles veh ON veh.vehicle_id = t.vehicle_id
    JOIN users u ON u.user_id = t.driver_id`;

const STATUSES = ['Pending', 'Approved', 'Active', 'Completed', 'Cancelled'];

const fetchTrip = async (conn, tripId) => {
    const [rows] = await conn.query(`${TRIP_SELECT} WHERE t.trip_id = ?`, [tripId]);
    return rows[0];
};

// Locks and returns the trip row, or throws 404
const lockTrip = async (conn, tripId) => {
    const [rows] = await conn.query('SELECT * FROM trips WHERE trip_id = ? FOR UPDATE', [tripId]);
    if (rows.length === 0) throw new HttpError(404, 'Trip not found.');
    return rows[0];
};

const lockVehicle = async (conn, vehicleId) => {
    const [rows] = await conn.query('SELECT * FROM vehicles WHERE vehicle_id = ? FOR UPDATE', [vehicleId]);
    return rows[0];
};

// ---------------------------------------------------------------- queries
const getTrips = async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.status !== undefined) {
        if (!STATUSES.includes(req.query.status)) throw new HttpError(400, 'Unknown trip status.');
        where = 'WHERE t.status = ?';
        params.push(req.query.status);
    }
    const [rows] = await db.query(`${TRIP_SELECT} ${where} ORDER BY t.trip_id DESC LIMIT 500`, params);
    res.json(rows);
};

const getMyTrips = async (req, res) => {
    const [rows] = await db.query(`${TRIP_SELECT} WHERE t.driver_id = ? ORDER BY FIELD(t.status,'Active','Approved','Pending','Completed','Cancelled'), t.trip_id DESC LIMIT 200`, [req.user.id]);
    res.json(rows);
};

// ---------------------------------------------------------------- lifecycle
// Admin creates a trip request; the vehicle is not reserved until the driver starts it.
const createTrip = async (req, res) => {
    const body = req.body || {};
    const vehicleId = v.id(body.vehicle_id, 'Vehicle');
    const driverId = v.id(body.driver_id, 'Driver');
    const destination = v.str(body.destination, 'Destination', { max: 255 });
    if (!LOCATIONS[destination]) throw new HttpError(400, 'Unknown destination. Choose one from the list.');

    const trip = await withTransaction(async (conn) => {
        const vehicle = await lockVehicle(conn, vehicleId);
        if (!vehicle || !vehicle.is_active) throw new HttpError(404, 'Vehicle not found.');
        if (vehicle.status !== 'Available') throw new HttpError(409, `Vehicle is currently ${vehicle.status} and cannot be assigned.`);
        const [drivers] = await conn.query("SELECT user_id FROM users WHERE user_id = ? AND role = 'Driver' AND is_active = TRUE", [driverId]);
        if (drivers.length === 0) throw new HttpError(404, 'Driver not found.');
        const [result] = await conn.query('INSERT INTO trips (vehicle_id, driver_id, destination) VALUES (?, ?, ?)', [vehicleId, driverId, destination]);
        return fetchTrip(conn, result.insertId);
    });
    res.status(201).json(trip);
};

// Pending -> Approved (availability re-checked)
const approveTrip = async (req, res) => {
    const tripId = v.id(req.params.id, 'Trip id');
    const trip = await withTransaction(async (conn) => {
        const t = await lockTrip(conn, tripId);
        if (t.status !== 'Pending') throw new HttpError(409, `Only Pending trips can be approved (this trip is ${t.status}).`);
        const vehicle = await lockVehicle(conn, t.vehicle_id);
        if (!vehicle.is_active || vehicle.status !== 'Available') throw new HttpError(409, `Vehicle is ${vehicle.is_active ? vehicle.status : 'deactivated'} and cannot be approved for this trip.`);
        await conn.query("UPDATE trips SET status = 'Approved' WHERE trip_id = ?", [tripId]);
        return fetchTrip(conn, tripId);
    });
    res.json(trip);
};

// Approved -> Active (driver). Re-checks availability, records the start odometer, marks the vehicle In Trip.
const startTrip = async (req, res) => {
    const tripId = v.id(req.params.id, 'Trip id');
    const trip = await withTransaction(async (conn) => {
        const t = await lockTrip(conn, tripId);
        if (t.driver_id !== req.user.id) throw new HttpError(403, 'This trip is assigned to another driver.');
        if (t.status !== 'Approved') throw new HttpError(409, `Only Approved trips can be started (this trip is ${t.status}).`);
        const [busy] = await conn.query("SELECT trip_id FROM trips WHERE driver_id = ? AND status = 'Active' LIMIT 1", [req.user.id]);
        if (busy.length > 0) throw new HttpError(409, 'You already have an active trip. Complete it first.');
        const vehicle = await lockVehicle(conn, t.vehicle_id);
        if (!vehicle.is_active || vehicle.status !== 'Available') throw new HttpError(409, `Vehicle is ${vehicle.is_active ? vehicle.status : 'deactivated'} and cannot start this trip.`);
        await conn.query("UPDATE trips SET status = 'Active', start_time = NOW(), start_odometer = ? WHERE trip_id = ?", [vehicle.current_odometer, tripId]);
        await conn.query("UPDATE vehicles SET status = 'In Trip' WHERE vehicle_id = ?", [t.vehicle_id]);
        return fetchTrip(conn, tripId);
    });
    emitToAdmins(req, 'TRIP_STARTED', { trip_id: trip.trip_id, vehicle_id: trip.vehicle_id, plate_number: trip.plate_number, destination: trip.destination });
    res.json(trip);
};

// Active -> Completed (driver). Atomic: trip, vehicle odometer/status and maintenance evaluation commit together.
const completeTrip = async (req, res) => {
    const tripId = v.id(req.params.id, 'Trip id');
    const finalOdometer = v.num(req.body && req.body.final_odometer, 'Final odometer', { min: 0, max: 99999999 });

    const { trip, maintenance } = await withTransaction(async (conn) => {
        const t = await lockTrip(conn, tripId);
        if (t.driver_id !== req.user.id) throw new HttpError(403, 'This trip is assigned to another driver.');
        if (t.status !== 'Active') throw new HttpError(409, `Only Active trips can be completed (this trip is ${t.status}).`);
        const vehicle = await lockVehicle(conn, t.vehicle_id);

        // Mileage integrity lock
        if (finalOdometer < Number(t.start_odometer)) throw new HttpError(400, `Final odometer cannot be less than the starting odometer (${t.start_odometer} km).`);
        if (finalOdometer < Number(vehicle.current_odometer)) throw new HttpError(400, `Final odometer cannot be less than the vehicle's current odometer (${vehicle.current_odometer} km).`);

        await conn.query("UPDATE trips SET status = 'Completed', final_odometer = ?, end_time = NOW() WHERE trip_id = ?", [finalOdometer, tripId]);
        await conn.query("UPDATE vehicles SET current_odometer = ?, status = 'Available' WHERE vehicle_id = ?", [finalOdometer, t.vehicle_id]);
        const result = await evaluateMaintenance(t.vehicle_id, conn);
        return { trip: await fetchTrip(conn, tripId), maintenance: result };
    });
    emitToAdmins(req, 'TRIP_COMPLETED', { trip_id: trip.trip_id, vehicle_id: trip.vehicle_id, plate_number: trip.plate_number, destination: trip.destination, alert_level: maintenance.level });
    res.json({ ...trip, maintenance_alert: maintenance.level });
};

// Pending/Approved -> Cancelled (admin)
const cancelTrip = async (req, res) => {
    const tripId = v.id(req.params.id, 'Trip id');
    const trip = await withTransaction(async (conn) => {
        const t = await lockTrip(conn, tripId);
        if (t.status !== 'Pending' && t.status !== 'Approved') throw new HttpError(409, `Only Pending or Approved trips can be cancelled (this trip is ${t.status}). Use abort for an active trip.`);
        await conn.query("UPDATE trips SET status = 'Cancelled' WHERE trip_id = ?", [tripId]);
        return fetchTrip(conn, tripId);
    });
    res.json(trip);
};

// Active -> Cancelled (admin emergency abort). The vehicle is freed; odometer is unchanged.
const terminateTrip = async (req, res) => {
    const tripId = v.id(req.params.id, 'Trip id');
    const trip = await withTransaction(async (conn) => {
        const t = await lockTrip(conn, tripId);
        if (t.status !== 'Active') throw new HttpError(409, `Only Active trips can be aborted (this trip is ${t.status}).`);
        await lockVehicle(conn, t.vehicle_id);
        await conn.query("UPDATE trips SET status = 'Cancelled', end_time = NOW() WHERE trip_id = ?", [tripId]);
        await conn.query("UPDATE vehicles SET status = 'Available' WHERE vehicle_id = ?", [t.vehicle_id]);
        return fetchTrip(conn, tripId);
    });
    emitToAdmins(req, 'TRIP_TERMINATED', { trip_id: trip.trip_id, vehicle_id: trip.vehicle_id });
    res.json(trip);
};

module.exports = { getTrips, getMyTrips, createTrip, approveTrip, startTrip, completeTrip, cancelTrip, terminateTrip };
