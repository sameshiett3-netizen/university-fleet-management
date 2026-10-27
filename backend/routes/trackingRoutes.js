const express = require('express');
const c = require('../controllers/trackingController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Simulator (shared secret)
router.post('/location', c.requireSimulator, c.receiveLocation);
router.get('/simulator/trips', c.requireSimulator, c.simulatorTrips);

// Administrator
router.get('/active', verifyToken, requireAdmin, c.activeTrips);
router.get('/history/:id', verifyToken, requireAdmin, c.history);

module.exports = router;
