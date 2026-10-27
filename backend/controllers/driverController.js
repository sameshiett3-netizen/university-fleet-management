const bcrypt = require('bcrypt');
const db = require('../config/db');
const { HttpError } = require('../utils/errors');
const { withTransaction } = require('../utils/tx');
const v = require('../utils/validate');

const COLUMNS = 'user_id, name, email, is_active, created_at';

const getDrivers = async (req, res) => {
    const [rows] = await db.query(`SELECT ${COLUMNS} FROM users WHERE role = 'Driver' AND is_active = TRUE ORDER BY name`);
    res.json(rows);
};

const createDriver = async (req, res) => {
    const body = req.body || {};
    const name = v.str(body.name, 'Name', { max: 100 });
    const email = v.email(body.email);
    const hash = await bcrypt.hash(v.password(body.password), 10);
    try {
        const [result] = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'Driver')", [name, email, hash]);
        const [rows] = await db.query(`SELECT ${COLUMNS} FROM users WHERE user_id = ?`, [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A user with this email already exists.');
        throw error;
    }
};

const updateDriver = async (req, res) => {
    const driverId = v.id(req.params.id, 'Driver id');
    const body = req.body || {};
    const fields = []; const values = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(v.str(body.name, 'Name', { max: 100 })); }
    if (body.email !== undefined) { fields.push('email = ?'); values.push(v.email(body.email)); }
    if (body.password !== undefined && body.password !== '') { fields.push('password_hash = ?'); values.push(await bcrypt.hash(v.password(body.password), 10)); }
    if (fields.length === 0) throw new HttpError(400, 'Nothing to update.');

    try {
        const [result] = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE user_id = ? AND role = 'Driver' AND is_active = TRUE`,
            [...values, driverId]
        );
        if (result.affectedRows === 0) {
            // affectedRows is 0 both when nothing matched and (rarely) when values are unchanged
            const [exists] = await db.query("SELECT user_id FROM users WHERE user_id = ? AND role = 'Driver' AND is_active = TRUE", [driverId]);
            if (exists.length === 0) throw new HttpError(404, 'Driver not found.');
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A user with this email already exists.');
        throw error;
    }
    const [rows] = await db.query(`SELECT ${COLUMNS} FROM users WHERE user_id = ?`, [driverId]);
    res.json(rows[0]);
};

const deactivateDriver = async (req, res) => {
    const driverId = v.id(req.params.id, 'Driver id');
    await withTransaction(async (conn) => {
        const [rows] = await conn.query("SELECT user_id FROM users WHERE user_id = ? AND role = 'Driver' AND is_active = TRUE FOR UPDATE", [driverId]);
        if (rows.length === 0) throw new HttpError(404, 'Driver not found.');
        const [open] = await conn.query("SELECT trip_id FROM trips WHERE driver_id = ? AND status IN ('Pending','Approved','Active') LIMIT 1", [driverId]);
        if (open.length > 0) throw new HttpError(409, 'This driver has open trips. Cancel or complete them first.');
        await conn.query('UPDATE users SET is_active = FALSE WHERE user_id = ?', [driverId]);
    });
    res.json({ message: 'Driver deactivated.' });
};

module.exports = { getDrivers, createDriver, updateDriver, deactivateDriver };
