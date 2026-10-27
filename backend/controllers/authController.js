const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { config } = require('../config/env');
const { HttpError } = require('../utils/errors');
const v = require('../utils/validate');

const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours
const cookieOptions = () => ({
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
});

// Used so that an unknown e-mail takes as long to reject as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const login = async (req, res) => {
    const email = v.email(req.body && req.body.email);
    const password = req.body && req.body.password;
    if (typeof password !== 'string' || password.length === 0) throw new HttpError(400, 'Email and password are required.');

    const [users] = await db.query('SELECT user_id, name, email, password_hash, role, is_active FROM users WHERE email = ?', [email]);
    const user = users[0];
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) throw new HttpError(401, 'Invalid email or password.');
    if (!user.is_active) throw new HttpError(403, 'This account has been deactivated.');

    const token = jwt.sign({ id: user.user_id, role: user.role }, config.jwtSecret, { expiresIn: '8h' });
    res.cookie('token', token, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE });
    res.json({ message: 'Login successful', user: { id: user.user_id, name: user.name, email: user.email, role: user.role } });
};

// Restores the session after a page refresh (the cookie is HttpOnly, so the browser cannot read it)
const session = (req, res) => {
    res.json({ user: req.user });
};

const logout = (req, res) => {
    res.clearCookie('token', cookieOptions());
    res.json({ message: 'Logged out successfully.' });
};

module.exports = { login, session, logout };
