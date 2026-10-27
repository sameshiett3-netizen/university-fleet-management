const mysql = require('mysql2/promise');
const { config } = require('./env');

const pool = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true, // return DECIMAL columns as numbers, not strings
    dateStrings: false,
});

module.exports = pool;
