const http = require('http');
const { config, assertSecrets } = require('./config/env');
const db = require('./config/db');
const app = require('./app');
const { initSocket } = require('./socket');

async function start() {
    assertSecrets();
    try {
        await db.query('SELECT 1');
    } catch (error) {
        console.error(`Cannot connect to MySQL at ${config.db.host}:${config.db.port} (${error.code || error.message}).`);
        console.error('Check DB_HOST, DB_PORT, DB_USER and DB_PASSWORD in backend/.env and make sure the MySQL server is running.');
        process.exit(1);
    }
    const server = http.createServer(app);
    initSocket(server, app);
    server.listen(config.port, () => {
        console.log(`Fleet API running on http://localhost:${config.port} (database ${config.db.database} on port ${config.db.port})`);
    });
}

start().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
