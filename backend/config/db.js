const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: '127.0.0.1',             // Forces the IPv4 bridge to Windows
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'fleet_db',          // Hardcoded database name
    port: 3307,                    // Hardcoded new port
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;