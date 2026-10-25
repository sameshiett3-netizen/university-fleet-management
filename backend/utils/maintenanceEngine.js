const db = require('../config/db');

const evaluateMaintenance = async (vehicle_id, connection) => {
    // 1. Get vehicle details
    const [vehicles] = await connection.query(
        'SELECT initial_odometer, current_odometer, service_interval_km FROM Vehicles WHERE vehicle_id = ?', 
        [vehicle_id]
    );
    const vehicle = vehicles[0];

    // 2. Get baseline (latest maintenance record OR initial odometer)
    const [records] = await connection.query(
        'SELECT odometer_at_service FROM Maintenance_Records WHERE vehicle_id = ? ORDER BY service_date DESC LIMIT 1',
        [vehicle_id]
    );
    
    const baseline_odometer = records.length > 0 ? records[0].odometer_at_service : vehicle.initial_odometer;
    
    // 3. Calculate wear and tear
    const distance_driven = vehicle.current_odometer - baseline_odometer;
    const wear_ratio = distance_driven / vehicle.service_interval_km;

    let alert_level = null;
    if (wear_ratio >= 1.0) alert_level = 'Overdue';
    else if (wear_ratio >= 0.9) alert_level = 'Warning';

    // 4. Generate alert if necessary and prevent duplicates
    if (alert_level) {
        const [existingAlerts] = await connection.query(
            'SELECT alert_id FROM Maintenance_Alerts WHERE vehicle_id = ? AND status = "Active" AND alert_level = ?',
            [vehicle_id, alert_level]
        );

        if (existingAlerts.length === 0) {
            await connection.query(
                'INSERT INTO Maintenance_Alerts (vehicle_id, alert_level, status) VALUES (?, ?, "Active")',
                [vehicle_id, alert_level]
            );
        }
    }
};

module.exports = { evaluateMaintenance };