const express = require('express');
const router = express.Router();
const { addVehicle, getVehicles } = require('../controllers/vehicleController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// GET /api/vehicles - Anyone logged in can view the fleet
router.get('/', verifyToken, getVehicles);

// POST /api/vehicles - ONLY Admins can add a new vehicle to the fleet
router.post('/', verifyToken, requireAdmin, addVehicle);

module.exports = router;