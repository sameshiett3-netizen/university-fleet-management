const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GPS Simulator pushes data here via a background script
router.post('/simulate', async (req, res) => {
    const { trip_id, latitude, longitude, destination, secret } = req.body;
    
    if (secret !== process.env.SIMULATOR_SECRET) return res.status(403).json({ error: 'Unauthorized simulator' });

    try {
        // Save to Location_History table
        await db.query('INSERT INTO Location_History (trip_id, latitude, longitude) VALUES (?, ?, ?)', [trip_id, latitude, longitude]);
        
        // Broadcast to React frontend via Socket.io (including destination)
        req.io.emit('vehicle_location_update', { trip_id, latitude, longitude, destination });
        
        res.status(200).send('Location logged and broadcasted');
    } catch (error) {
        res.status(500).send('Error logging location');
    }
});

module.exports = router;