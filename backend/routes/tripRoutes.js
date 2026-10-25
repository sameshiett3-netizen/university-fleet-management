const express = require('express');
const router = express.Router();
const { createTrip, updateTripState } = require('../controllers/tripController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const db = require('../config/db'); // Required for database queries

router.post('/', verifyToken, createTrip);
router.put('/:trip_id', verifyToken, updateTripState); // Admin handles approvals, Drivers handle Active/Complete

// PUT /api/trips/:trip_id/terminate - Abort an active trip in progress
router.put('/:trip_id/terminate', verifyToken, requireAdmin, async (req, res) => {
    const { trip_id } = req.params;

    try {
        // 1. Fetch the vehicle associated with this trip
        const [tripRows] = await db.execute('SELECT vehicle_id, status FROM trips WHERE trip_id = ?', [trip_id]);
        
        if (tripRows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const vehicleId = tripRows[0].vehicle_id;

        // 2. Update trip status to Cancelled
        await db.execute('UPDATE trips SET status = "Cancelled" WHERE trip_id = ?', [trip_id]);

        // 3. Free up the vehicle back to Available status
        if (vehicleId) {
            await db.execute('UPDATE vehicles SET status = "Available" WHERE vehicle_id = ?', [vehicleId]);
        }

        // 4. Broadcast termination event via Socket.io to clear maps instantly
        if (req.io) {
            req.io.emit('TRIP_TERMINATED', { trip_id, vehicle_id: vehicleId });
        }

        res.json({ success: true, message: `Trip ${trip_id} successfully terminated and vehicle freed.` });
    } catch (error) {
        console.error("Trip termination error:", error.message);
        res.status(500).json({ error: 'Failed to terminate trip' });
    }
});

module.exports = router;