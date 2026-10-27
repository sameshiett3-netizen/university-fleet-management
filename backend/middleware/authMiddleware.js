const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { config } = require('../config/env');
const { HttpError } = require('../utils/errors');

// Resolves a JWT to a live, active user (so deactivated accounts lose access immediately).
async function userFromToken(token) {
    let decoded;
    try {
        decoded = jwt.verify(token, config.jwtSecret);
    } catch (_) {
        throw new HttpError(401, 'Invalid or expired token.');
    }
    const [rows] = await db.query('SELECT user_id, name, email, role, is_active FROM users WHERE user_id = ?', [decoded.id]);
    if (rows.length === 0 || !rows[0].is_active) throw new HttpError(401, 'Account not found or deactivated.');
    const u = rows[0];
    return { id: u.user_id, name: u.name, email: u.email, role: u.role };
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies && req.cookies.token;
    if (!token) throw new HttpError(401, 'Not authenticated.');
    req.user = await userFromToken(token);
    next();
};

const requireRole = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) throw new HttpError(403, `${role} privileges required.`);
    next();
};

// Basic CSRF defence: state-changing requests must carry a custom header that cross-site forms cannot set.
const requireXHR = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if ((req.get('x-requested-with') || '').toLowerCase() !== 'xmlhttprequest') {
        throw new HttpError(403, 'Missing X-Requested-With header.');
    }
    next();
};

module.exports = {
    verifyToken,
    requireAdmin: requireRole('Admin'),
    requireDriver: requireRole('Driver'),
    requireXHR,
    userFromToken,
};
