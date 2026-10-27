// Test environment: must be loaded before any application module.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'fleet_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SIMULATOR_SECRET = process.env.SIMULATOR_SECRET || 'test-simulator-secret';

const bcrypt = require('bcrypt');
const { initDatabase } = require('../scripts/initDb');
const db = require('../config/db');

async function resetDatabase() {
    await initDatabase({ reset: true });
}

async function createUser(name, email, password, role) {
    const hash = await bcrypt.hash(password, 4);
    const [r] = await db.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
    return r.insertId;
}

module.exports = { resetDatabase, createUser, db };
