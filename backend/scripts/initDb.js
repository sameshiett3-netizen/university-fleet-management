// Creates the database and tables from database/schema.sql.
//   node scripts/initDb.js            create anything that is missing
//   node scripts/initDb.js --reset    DROP all fleet tables first (destroys data!)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { config } = require('../config/env');

const OLD_PROTOTYPE_TABLES = ['Maintenance_Alerts', 'Maintenance_Records', 'Location_History', 'Trips', 'Vehicles', 'Users'];
const TABLES = ['maintenance_alerts', 'maintenance_records', 'location_history', 'trips', 'vehicles', 'users'];

async function initDatabase({ reset = false } = {}) {
    const dbName = config.db.database;
    if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may contain only letters, digits and underscores.');

    const conn = await mysql.createConnection({
        host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, multipleStatements: true,
    });
    try {
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await conn.query(`USE \`${dbName}\``);

        if (reset) {
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');
            for (const t of [...TABLES, ...OLD_PROTOTYPE_TABLES]) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        } else {
            // Refuse to build on top of the old prototype schema (it used different columns)
            const [cols] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'", [dbName]);
            const names = cols.map((c) => c.COLUMN_NAME);
            if (names.length > 0 && !names.includes('password_hash')) {
                throw new Error('An older (prototype) schema was found in this database. Run "npm run db:reset" to rebuild it (this deletes existing data).');
            }
        }

        let sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
        sql = sql.replace(/\bfleet_db\b/g, dbName);
        await conn.query(sql);
    } finally {
        await conn.end();
    }
}

module.exports = { initDatabase };

if (require.main === module) {
    initDatabase({ reset: process.argv.includes('--reset') })
        .then(() => { console.log(`Database "${config.db.database}" is ready.`); process.exit(0); })
        .catch((error) => { console.error(error.message); process.exit(1); });
}
