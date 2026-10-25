require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function seedMassVehicles() {
    try {
        const db = await mysql.createConnection({
            host: '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: 'fleet_db',
            port: 3307
        });

        console.log('🚀 Connected to database on port 3307 via IPv4. Generating 300 ABU campus vehicles...');

        const models = ['Toyota Hiace', 'Toyota Coaster', 'Ford Transit', 'Toyota Hilux (Security)', 'Peugeot 508 (Faculty)'];
        const statuses = ['Available', 'Available', 'Available', 'Available', 'On Trip', 'On Trip', 'Maintenance'];

        for (let i = 1; i <= 300; i++) {
            const plate = `ABU-${100 + i}-${['KAD', 'KNO', 'ABJ', 'ZAR'][Math.floor(Math.random() * 4)]}`;
            const model = models[Math.floor(Math.random() * models.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const odometer = Math.floor(Math.random() * 15000); 

            await db.execute(
                'INSERT INTO Vehicles (plate_number, model, current_odometer, service_interval_km, status) VALUES (?, ?, ?, ?, ?)',
                [plate, model, odometer, 5000, status]
            );
        }

        console.log('✅ Successfully injected 300 vehicles into the fleet database!');
        process.exit();

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedMassVehicles();