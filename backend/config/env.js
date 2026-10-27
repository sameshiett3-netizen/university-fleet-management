// Loads environment variables once. backend/.env wins over the repository-root .env.
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

const config = {
    isProduction,
    port: Number(process.env.PORT) || 5000,
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    jwtSecret: process.env.JWT_SECRET,
    simulatorSecret: process.env.SIMULATOR_SECRET,
    // Cookie settings differ between a local demo and a cross-site cloud deployment
    cookie: {
        secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
        sameSite: process.env.COOKIE_SAMESITE || 'strict',
    },
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'fleet_db',
    },
};

// Fail fast on missing secrets instead of failing on the first request
function assertSecrets() {
    const missing = [];
    if (!config.jwtSecret) missing.push('JWT_SECRET');
    if (!config.simulatorSecret) missing.push('SIMULATOR_SECRET');
    if (missing.length) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to backend/.env and fill them in.`);
    }
}

module.exports = { config, assertSecrets };
