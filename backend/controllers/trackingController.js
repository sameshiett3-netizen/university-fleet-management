const crypto = require('crypto');
const db = require('../config/db');
const { config } = require('../config/env');
const { LOCATIONS } = require('../config/locations');
const { HttpError } = require('../utils/errors');
const { emitToAdmins } = require('../utils/realtime');
const v = require('../utils/validate');

// The GPS simulator is a non-human client: it authenticates with a shared secret, not a user account.
const requireSimulator = (req, res, next) => {
    const provided = String(req.get('x-simulator-secret') || (req.body && req.body.secret) || '');
    const expected = String(config.simulatorSecret || '');
    const a = Buffer.from(provided); const b = Buffer.from(expected);
    if (expected.length === 0 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new HttpError(403, 'Unauthorized simulator.');
    }
    next();
};

// POST /api/tracking/location   (simulator)
const receiveLocation = async (req, res) => {
    const body = req.body || {};
    const tripId = v.id(body.trip_id, 'trip_id');
    const latitude = v.num(body.latitude, 'latitude', { min: -90, max: 90 });
    const longitude = v.num(body.longitude, 'longitude', { min: -180, max: 180 });

    const [rows] = await db.query(
        `SELECT t.trip_id, t.vehicle_id, t.destination, t.status, veh.plate_number
         FROM trips t JOIN vehicles veh ON veh.vehicle_id = t.vehicle_id WHERE t.trip_id = ?`, [tripId]);
    if (rows.length === 0) throw new HttpError(404, 'Trip not found.');
    const trip = rows[0];
    if (trip.status !== 'Active') throw new HttpError(409, `Trip is ${trip.status}; coordinates are only accepted for Active trips.`);

    await db.query('INSERT INTO location_history (trip_id, latitude, longitude) VALUES (?, ?, ?)', [tripId, latitude, longitude]);
    emitToAdmins(req, 'vehicle_location_update', {
        trip_id: tripId, vehicle_id: trip.vehicle_id, plate_number: trip.plate_number,
        destination: trip.destination, latitude, longitude, timestamp: new Date().toISOString(),
    });
    res.status(201).json({ success: true });
};

// GET /api/tracking/simulator/trips   (simulator): Active trips it should drive, with destination coordinates
const simulatorTrips = async (req, res) => {
    const [rows] = await db.query("SELECT trip_id, destination FROM trips WHERE status = 'Active' ORDER BY trip_id");
    res.json(rows.map((t) => ({ trip_id: t.trip_id, destination: t.destination, destination_coords: LOCATIONS[t.destination] || null })));
};

// GET /api/tracking/active   (admin): everything the map needs, so it survives a page refresh
const activeTrips = async (req, res) => {
    const [trips] = await db.query(`
        SELECT t.trip_id, t.vehicle_id, t.destination, t.start_time, veh.plate_number, veh.model, u.name AS driver_name
        FROM trips t JOIN vehicles veh ON veh.vehicle_id = t.vehicle_id JOIN users u ON u.user_id = t.driver_id
        WHERE t.status = 'Active' ORDER BY t.trip_id`);
    let points = [];
    if (trips.length > 0) {
        [points] = await db.query(
            'SELECT trip_id, latitude, longitude FROM location_history WHERE trip_id IN (?) ORDER BY location_id LIMIT 20000',
            [trips.map((t) => t.trip_id)]);
    }
    res.json(trips.map((t) => ({
        ...t,
        destination_coords: LOCATIONS[t.destination] || null,
        path: points.filter((p) => p.trip_id === t.trip_id).map((p) => [Number(p.latitude), Number(p.longitude)]),
    })));
};

// GET /api/tracking/history/:id   (admin): stored route of one trip
const history = async (req, res) => {
    const tripId = v.id(req.params.id, 'Trip id');
    const [trips] = await db.query('SELECT trip_id, destination, status FROM trips WHERE trip_id = ?', [tripId]);
    if (trips.length === 0) throw new HttpError(404, 'Trip not found.');
    const [points] = await db.query('SELECT latitude, longitude, timestamp FROM location_history WHERE trip_id = ? ORDER BY location_id', [tripId]);
    res.json({ ...trips[0], points: points.map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude), timestamp: p.timestamp })) });
};

module.exports = { requireSimulator, receiveLocation, simulatorTrips, activeTrips, history };
