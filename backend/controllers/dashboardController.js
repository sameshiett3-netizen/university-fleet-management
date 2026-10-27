const db = require('../config/db');

const getSummary = async (req, res) => {
    const [[vehicles]] = await db.query(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(status = 'Available'), 0) AS available,
               COALESCE(SUM(status = 'In Trip'), 0) AS in_trip,
               COALESCE(SUM(status = 'Maintenance'), 0) AS in_maintenance
        FROM vehicles WHERE is_active = TRUE`);
    const [[trips]] = await db.query(`
        SELECT COALESCE(SUM(status = 'Active'), 0) AS active,
               COALESCE(SUM(status = 'Pending'), 0) AS pending,
               COALESCE(SUM(status = 'Approved'), 0) AS approved,
               COALESCE(SUM(status = 'Completed'), 0) AS completed
        FROM trips`);
    const [[alerts]] = await db.query(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(a.alert_level = 'Warning'), 0) AS warning,
               COALESCE(SUM(a.alert_level = 'Overdue'), 0) AS overdue
        FROM maintenance_alerts a JOIN vehicles veh ON veh.vehicle_id = a.vehicle_id
        WHERE a.status = 'Active' AND veh.is_active = TRUE`);
    const [[drivers]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'Driver' AND is_active = TRUE");
    const n = (o) => Object.fromEntries(Object.entries(o).map(([k, val]) => [k, Number(val)]));
    res.json({ vehicles: n(vehicles), trips: n(trips), alerts: n(alerts), drivers: n(drivers) });
};

module.exports = { getSummary };
