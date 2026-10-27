// Loads a small, realistic demo data set (drivers and vehicles) so the system can be shown immediately.
// Safe to run once on an empty fleet; it refuses to touch a database that already has vehicles.
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { withTransaction } = require('../utils/tx');
const { evaluateMaintenance } = require('../utils/maintenanceEngine');

const DRIVER_PASSWORD = process.env.DEMO_DRIVER_PASSWORD || 'Driver@123';

const DRIVERS = [
    ['Musa Ibrahim', 'musa.ibrahim@abu.edu.ng'],
    ['Aisha Bello', 'aisha.bello@abu.edu.ng'],
    ['Emeka Okafor', 'emeka.okafor@abu.edu.ng'],
];

// [plate, model, initial odometer, current odometer, service interval]
const VEHICLES = [
    ['ABU-101-ZAR', 'Toyota Hiace', 20000, 21200, 5000],      // healthy
    ['ABU-102-ZAR', 'Toyota Coaster', 15000, 19600, 5000],    // 4,600 km since baseline -> Warning
    ['ABU-103-KAD', 'Ford Transit', 30000, 35300, 5000],      // 5,300 km since baseline -> Overdue
    ['ABU-104-ZAR', 'Toyota Hilux (Security)', 8000, 9100, 5000],
    ['ABU-105-KNO', 'Peugeot 508 (Faculty)', 12000, 12400, 5000],
    ['ABU-106-ZAR', 'Toyota Hiace', 45000, 47500, 10000],
    ['ABU-107-ABJ', 'Toyota Coaster', 60000, 63200, 5000],
    ['ABU-108-ZAR', 'Ford Transit', 5000, 5000, 5000],
];

async function seedDemo() {
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM vehicles');
    if (n > 0) { console.log('The vehicles table is not empty; demo data was not loaded.'); return; }

    const hash = await bcrypt.hash(DRIVER_PASSWORD, 10);
    await withTransaction(async (conn) => {
        for (const [name, email] of DRIVERS) {
            await conn.query("INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'Driver')", [name, email, hash]);
        }
        for (const [plate, model, initial, current, interval] of VEHICLES) {
            const [r] = await conn.query(
                'INSERT INTO vehicles (plate_number, model, initial_odometer, current_odometer, service_interval_km) VALUES (?, ?, ?, ?, ?)',
                [plate, model, initial, current, interval]);
            if (plate === 'ABU-107-ABJ') {
                // Serviced earlier: the baseline is the service odometer, not the initial odometer
                await conn.query("INSERT INTO maintenance_records (vehicle_id, service_date, odometer_at_service, details) VALUES (?, CURDATE() - INTERVAL 60 DAY, 60000, 'Routine 5,000 km service: oil, filters, brake check')", [r.insertId]);
            }
            await evaluateMaintenance(r.insertId, conn);
        }
    });
    console.log(`Demo data loaded: ${DRIVERS.length} drivers (password: ${DRIVER_PASSWORD}) and ${VEHICLES.length} vehicles.`);
}

seedDemo()
    .then(() => process.exit(0))
    .catch((error) => { console.error(error.message); process.exit(1); });
