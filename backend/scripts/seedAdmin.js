// Creates the first administrator (there is deliberately no public registration endpoint).
// Reads ADMIN_EMAIL (default admin@abu.edu.ng) and ADMIN_PASSWORD from the environment;
// if no password is given, a random one is generated and printed once.
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedAdmin() {
    const email = (process.env.ADMIN_EMAIL || 'admin@abu.edu.ng').trim().toLowerCase();
    const name = process.env.ADMIN_NAME || 'System Administrator';
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password) { password = crypto.randomBytes(9).toString('base64url'); generated = true; }
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');

    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
        console.log(`An account for ${email} already exists. Nothing changed.`);
        return;
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'Admin')", [name, email, hash]);
    console.log(`Administrator created: ${email}`);
    if (generated) console.log(`Generated password (shown once): ${password}`);
}

seedAdmin()
    .then(() => process.exit(0))
    .catch((error) => { console.error(error.message); process.exit(1); });
