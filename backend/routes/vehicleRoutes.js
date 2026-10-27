const express = require('express');
const c = require('../controllers/vehicleController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(verifyToken, requireAdmin);

router.get('/', c.getVehicles);
router.post('/', c.addVehicle);
router.put('/:id', c.updateVehicle);
router.delete('/:id', c.deactivateVehicle);
router.put('/:id/status', c.setVehicleStatus);

module.exports = router;
