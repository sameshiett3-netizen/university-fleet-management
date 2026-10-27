const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const db = require('./config/db');
const { LOCATIONS } = require('./config/locations');
const { verifyToken, requireXHR } = require('./middleware/authMiddleware');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// CSRF defence for browser clients. The simulator endpoint is exempt: it is not a browser and uses a secret.
app.use('/api', (req, res, next) => (req.path === '/tracking/location' ? next() : requireXHR(req, res, next)));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/trips', require('./routes/tripRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.get('/api/locations', verifyToken, (req, res) => {
    res.json(Object.entries(LOCATIONS).map(([name, c]) => ({ name, lat: c.lat, lng: c.lng })).sort((a, b) => a.name.localeCompare(b.name)));
});

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (_) {
        res.status(503).json({ status: 'error', database: 'unreachable' });
    }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
