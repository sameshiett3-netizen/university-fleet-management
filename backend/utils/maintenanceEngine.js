// Deterministic, odometer-based predictive maintenance (see report, Section 3.6.5).
//   Next_Service_Due = baseline + service_interval_km
//   Overdue : current >= Next_Service_Due
//   Warning : current >= Next_Service_Due - 10% of the interval
// A vehicle has at most one Active alert; its level is escalated or de-escalated as the odometer or
// the interval changes, and the alert is resolved automatically when neither condition holds.

const WARNING_FRACTION = 0.10;

function classify(currentOdometer, baselineOdometer, intervalKm) {
    const nextServiceDue = baselineOdometer + intervalKm;
    const warningAt = nextServiceDue - WARNING_FRACTION * intervalKm;
    const eps = 1e-6;
    let level = null;
    if (currentOdometer + eps >= nextServiceDue) level = 'Overdue';
    else if (currentOdometer + eps >= warningAt) level = 'Warning';
    return { level, nextServiceDue, warningAt };
}

// Must be called with a connection that is inside a transaction.
async function evaluateMaintenance(vehicleId, connection) {
    const [vehicles] = await connection.query(
        'SELECT initial_odometer, current_odometer, service_interval_km FROM vehicles WHERE vehicle_id = ? FOR UPDATE',
        [vehicleId]
    );
    if (vehicles.length === 0) return { level: null, nextServiceDue: null, baseline: null };
    const v = vehicles[0];

    const [records] = await connection.query(
        'SELECT odometer_at_service FROM maintenance_records WHERE vehicle_id = ? ORDER BY service_date DESC, record_id DESC LIMIT 1',
        [vehicleId]
    );
    const baseline = records.length > 0 ? Number(records[0].odometer_at_service) : Number(v.initial_odometer);
    const { level, nextServiceDue } = classify(Number(v.current_odometer), baseline, Number(v.service_interval_km));

    const [active] = await connection.query(
        "SELECT alert_id, alert_level FROM maintenance_alerts WHERE vehicle_id = ? AND status = 'Active' ORDER BY alert_id FOR UPDATE",
        [vehicleId]
    );

    if (level === null) {
        if (active.length > 0) {
            await connection.query(
                "UPDATE maintenance_alerts SET status = 'Resolved', resolved_at = NOW() WHERE vehicle_id = ? AND status = 'Active'",
                [vehicleId]
            );
        }
    } else if (active.length === 0) {
        await connection.query(
            "INSERT INTO maintenance_alerts (vehicle_id, alert_level, status) VALUES (?, ?, 'Active')",
            [vehicleId, level]
        );
    } else {
        const [keep, ...extras] = active;
        if (keep.alert_level !== level) {
            await connection.query('UPDATE maintenance_alerts SET alert_level = ? WHERE alert_id = ?', [level, keep.alert_id]);
        }
        if (extras.length > 0) {
            await connection.query(
                "UPDATE maintenance_alerts SET status = 'Resolved', resolved_at = NOW() WHERE alert_id IN (?)",
                [extras.map((a) => a.alert_id)]
            );
        }
    }
    return { level, nextServiceDue, baseline };
}

module.exports = { evaluateMaintenance, classify, WARNING_FRACTION };
