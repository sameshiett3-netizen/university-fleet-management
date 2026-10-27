const { HttpError } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value, field, { min = 1, max = 255 } = {}) {
    if (typeof value !== 'string') throw new HttpError(400, `${field} is required.`);
    const v = value.trim();
    if (v.length < min) throw new HttpError(400, `${field} is required.`);
    if (v.length > max) throw new HttpError(400, `${field} must be at most ${max} characters.`);
    return v;
}

function num(value, field, { min = -Infinity, max = Infinity, integer = false } = {}) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
        throw new HttpError(400, `${field} is required.`);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new HttpError(400, `${field} must be a number.`);
    if (integer && !Number.isInteger(n)) throw new HttpError(400, `${field} must be a whole number.`);
    if (n < min) throw new HttpError(400, `${field} must be at least ${min}.`);
    if (n > max) throw new HttpError(400, `${field} must be at most ${max}.`);
    return n;
}

function id(value, field = 'id') {
    return num(value, field, { min: 1, integer: true });
}

function email(value) {
    const v = str(value, 'Email', { max: 100 }).toLowerCase();
    if (!EMAIL_RE.test(v)) throw new HttpError(400, 'Email address is not valid.');
    return v;
}

function password(value) {
    if (typeof value !== 'string' || value.length < 8) {
        throw new HttpError(400, 'Password must be at least 8 characters.');
    }
    if (value.length > 72) throw new HttpError(400, 'Password must be at most 72 characters.');
    return value;
}

function isoDate(value, field = 'Date') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new HttpError(400, `${field} must be in YYYY-MM-DD format.`);
    }
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
        throw new HttpError(400, `${field} is not a valid date.`);
    }
    return value;
}

module.exports = { str, num, id, email, password, isoDate };
