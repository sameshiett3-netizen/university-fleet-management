const db = require('../config/db');

// Runs fn(connection) inside a transaction; commits on success, rolls back on any error.
async function withTransaction(fn) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
    } catch (error) {
        try { await connection.rollback(); } catch (_) { /* connection already lost */ }
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { withTransaction };
