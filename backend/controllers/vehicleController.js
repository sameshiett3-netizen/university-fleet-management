const db = require('../config/db');
const { HttpError } = require('../utils/errors');
const { withTransaction } = require('../utils/tx');
const { evaluateMaintenance } = require('../utils/maintenanceEngine');
const v = require('../utils/validate');

const VEHICLE_SELECT = `
    SELECT veh.vehicle_id, veh.plate_number, veh.model, veh.initial_odometer, veh.current_odometer,
           veh.service_interval_km, veh.status, veh.is_active, veh.created_at,
           COALESCE((SELECT r.odometer_at_service FROM maintenance_records r WHERE r.vehicle_id = veh.vehicle_id
                     ORDER BY r.service_date DESC, r.record_id DESC LIMIT 1), veh.initial_odometer) AS baseline_odometer,
           (SELECT a.alert_level FROM maintenance_alerts a WHERE a.vehicle_id = veh.vehicle_id AND a.status = 'Active'
                     ORDER BY a.alert_id LIMIT 1) AS active_alert
    FROM vehicles veh`;

const withDue = (row) => ({ ...row, next_service_due: Number(row.baseline_odometer) + Number(row.service_interval_km) });

const STATUSES = ['Available', 'In Trip', 'Maintenance'];

const getVehicles = async (req, res) => {
    const params = [];
    let where = 'WHERE veh.is_active = TRUE';
    if (req.query.status !== undefined) {
        if (!STATUSES.includes(req.query.status)) throw new HttpError(400, 'Unknown vehicle status.');
        where += ' AND veh.status = ?';
        params.push(req.query.status);
    }
    const [rows] = await db.query(`${VEHICLE_SELECT} ${where} ORDER BY veh.plate_number`, params);
    res.json(rows.map(withDue));
};

const fetchVehicle = async (connOrDb, vehicleId) => {
    const [rows] = await connOrDb.query(`${VEHICLE_SELECT} WHERE veh.vehicle_id = ? AND veh.is_active = TRUE`, [vehicleId]);
    if (rows.length === 0) throw new HttpError(404, 'Vehicle not found.');
    return withDue(rows[0]);
};

const addVehicle = async (req, res) => {
    const body = req.body || {};
    const plate = v.str(body.plate_number, 'Plate number', { max: 20 }).toUpperCase();
    const model = v.str(body.model, 'Model', { max: 100 });
    const initial = body.initial_odometer === undefined || body.initial_odometer === '' ? 0 : v.num(body.initial_odometer, 'Odometer', { min: 0, max: 99999999 });
    const interval = body.service_interval_km === undefined || body.service_interval_km === '' ? 5000 : v.num(body.service_interval_km, 'Service interval', { min: 1, max: 1000000, integer: true });

    const vehicleId = await withTransaction(async (conn) => {
        try {
            const [result] = await conn.query(
                'INSERT INTO vehicles (plate_number, model, initial_odometer, current_odometer, service_interval_km) VALUES (?, ?, ?, ?, ?)',
                [plate, model, initial, initial, interval]
            );
            await evaluateMaintenance(result.insertId, conn);
            return result.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A vehicle with this plate number already exists.');
            throw error;
        }
    });
    res.status(201).json(await fetchVehicle(db, vehicleId));
};

const updateVehicle = async (req, res) => {
    const vehicleId = v.id(req.params.id, 'Vehicle id');
    const body = req.body || {};
    const fields = []; const values = [];
    if (body.plate_number !== undefined) { fields.push('plate_number = ?'); values.push(v.str(body.plate_number, 'Plate number', { max: 20 }).toUpperCase()); }
    if (body.model !== undefined) { fields.push('model = ?'); values.push(v.str(body.model, 'Model', { max: 100 })); }
    if (body.service_interval_km !== undefined) { fields.push('service_interval_km = ?'); values.push(v.num(body.service_interval_km, 'Service interval', { min: 1, max: 1000000, integer: true })); }
    if (fields.length === 0) throw new HttpError(400, 'Nothing to update.');

    await withTransaction(async (conn) => {
        const [rows] = await conn.query('SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? AND is_active = TRUE FOR UPDATE', [vehicleId]);
        if (rows.length === 0) throw new HttpError(404, 'Vehicle not found.');
        try {
            await conn.query(`UPDATE vehicles SET ${fields.join(', ')} WHERE vehicle_id = ?`, [...values, vehicleId]);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A vehicle with this plate number already exists.');
            throw error;
        }
        await evaluateMaintenance(vehicleId, conn); // a changed interval can change the alert level
    });
    res.json(await fetchVehicle(db, vehicleId));
};

// Soft delete: the row stays so that historical trips and service records remain intact
const deactivateVehicle = async (req, res) => {
    const vehicleId = v.id(req.params.id, 'Vehicle id');
    await withTransaction(async (conn) => {
        const [rows] = await conn.query('SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? AND is_active = TRUE FOR UPDATE', [vehicleId]);
        if (rows.length === 0) throw new HttpError(404, 'Vehicle not found.');
        const [open] = await conn.query("SELECT trip_id FROM trips WHERE vehicle_id = ? AND status IN ('Pending','Approved','Active') LIMIT 1", [vehicleId]);
        if (open.length > 0) throw new HttpError(409, 'This vehicle has open trips. Cancel or complete them first.');
        await conn.query('UPDATE vehicles SET is_active = FALSE WHERE vehicle_id = ?', [vehicleId]);
        await conn.query("UPDATE maintenance_alerts SET status = 'Resolved', resolved_at = NOW() WHERE vehicle_id = ? AND status = 'Active'", [vehicleId]);
    });
    res.json({ message: 'Vehicle deactivated.' });
};

// Manually move a vehicle in or out of Maintenance status
const setVehicleStatus = async (req, res) => {
    const vehicleId = v.id(req.params.id, 'Vehicle id');
    const status = req.body && req.body.status;
    if (status !== 'Available' && status !== 'Maintenance') throw new HttpError(400, "Status must be 'Available' or 'Maintenance'.");
    await withTransaction(async (conn) => {
        const [rows] = await conn.query('SELECT status FROM vehicles WHERE vehicle_id = ? AND is_active = TRUE FOR UPDATE', [vehicleId]);
        if (rows.length === 0) throw new HttpError(404, 'Vehicle not found.');
        if (rows[0].status === 'In Trip') throw new HttpError(409, 'A vehicle that is on a trip cannot change status.');
        await conn.query('UPDATE vehicles SET status = ? WHERE vehicle_id = ?', [status, vehicleId]);
    });
    res.json(await fetchVehicle(db, vehicleId));
};

module.exports = { getVehicles, addVehicle, updateVehicle, deactivateVehicle, setVehicleStatus };
