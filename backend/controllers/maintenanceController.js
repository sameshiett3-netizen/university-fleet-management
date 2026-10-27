const db = require('../config/db');
const { HttpError } = require('../utils/errors');
const { withTransaction } = require('../utils/tx');
const { evaluateMaintenance } = require('../utils/maintenanceEngine');
const v = require('../utils/validate');

const getAlerts = async (req, res) => {
    const [rows] = await db.query(`
        SELECT a.alert_id, a.vehicle_id, a.alert_level, a.status, a.created_at,
               veh.plate_number, veh.model, veh.current_odometer, veh.service_interval_km,
               COALESCE((SELECT r.odometer_at_service FROM maintenance_records r WHERE r.vehicle_id = veh.vehicle_id
                         ORDER BY r.service_date DESC, r.record_id DESC LIMIT 1), veh.initial_odometer) AS baseline_odometer
        FROM maintenance_alerts a
        JOIN vehicles veh ON veh.vehicle_id = a.vehicle_id
        WHERE a.status = 'Active' AND veh.is_active = TRUE
        ORDER BY FIELD(a.alert_level, 'Overdue', 'Warning'), a.created_at DESC`);
    res.json(rows.map((r) => ({ ...r, next_service_due: Number(r.baseline_odometer) + Number(r.service_interval_km) })));
};

const getServiceHistory = async (req, res) => {
    const vehicleId = v.id(req.params.id, 'Vehicle id');
    const [veh] = await db.query('SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?', [vehicleId]);
    if (veh.length === 0) throw new HttpError(404, 'Vehicle not found.');
    const [rows] = await db.query(
        'SELECT record_id, vehicle_id, service_date, odometer_at_service, details, created_at FROM maintenance_records WHERE vehicle_id = ? ORDER BY service_date DESC, record_id DESC',
        [vehicleId]
    );
    res.json(rows);
};

// Logging a service moves the baseline forward and resolves the vehicle's Active alerts.
const logService = async (req, res) => {
    const body = req.body || {};
    const vehicleId = v.id(body.vehicle_id, 'Vehicle');
    const serviceDate = v.isoDate(body.service_date, 'Service date');
    const odometer = v.num(body.odometer_at_service, 'Odometer at service', { min: 0, max: 99999999 });
    const details = body.details === undefined || body.details === null || body.details === '' ? null : v.str(body.details, 'Details', { max: 2000 });
    if (serviceDate > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Service date cannot be in the future.');

    const result = await withTransaction(async (conn) => {
        const [rows] = await conn.query('SELECT current_odometer FROM vehicles WHERE vehicle_id = ? AND is_active = TRUE FOR UPDATE', [vehicleId]);
        if (rows.length === 0) throw new HttpError(404, 'Vehicle not found.');
        if (odometer > Number(rows[0].current_odometer)) throw new HttpError(400, `Odometer at service cannot exceed the vehicle's current odometer (${rows[0].current_odometer} km).`);

        const [ins] = await conn.query(
            'INSERT INTO maintenance_records (vehicle_id, service_date, odometer_at_service, details) VALUES (?, ?, ?, ?)',
            [vehicleId, serviceDate, odometer, details]
        );
        await conn.query("UPDATE maintenance_alerts SET status = 'Resolved', resolved_at = NOW() WHERE vehicle_id = ? AND status = 'Active'", [vehicleId]);
        const evaluation = await evaluateMaintenance(vehicleId, conn); // baseline moved; re-check
        return { record_id: ins.insertId, next_service_due: evaluation.nextServiceDue, alert_level: evaluation.level };
    });
    res.status(201).json(result);
};

module.exports = { getAlerts, getServiceHistory, logService };
