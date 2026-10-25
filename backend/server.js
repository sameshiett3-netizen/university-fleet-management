const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/db');

// Import all routes
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const tripRoutes = require('./routes/tripRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes'); // <--- 1. Imported maintenance routes

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSockets for Map Tracking
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true
    }
});

// Make Socket.io accessible inside standard Express routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

// Route Middlewares
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/maintenance', maintenanceRoutes); // <--- 2. Mounted maintenance routes

// Database Test
app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS solution');
        res.json({ message: 'Database connected successfully!', data: rows });
    } catch (error) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Endpoint for the GPS Simulator to trigger trip completion and notify dashboards
app.post('/api/telemetry/complete', (req, res) => {
    const { trip_id, vehicle_id, destination, secret } = req.body;
    
    if (secret !== process.env.SIMULATOR_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Broadcast trip completion event to all connected dashboard clients via Socket.io
    io.emit('TRIP_COMPLETED', {
        trip_id,
        vehicle_id,
        destination
    });

    res.json({ success: true, message: 'Trip completion broadcasted' });
});

// WebSocket Connection Listener
io.on('connection', (socket) => {
    console.log(`Admin Dashboard Connected to live tracking stream: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log('Admin Dashboard Disconnected');
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running with WebSockets on port ${PORT}`);
});