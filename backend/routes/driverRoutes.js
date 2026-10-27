const express = require('express');
const c = require('../controllers/driverController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(verifyToken, requireAdmin);

router.get('/', c.getDrivers);
router.post('/', c.createDriver);
router.put('/:id', c.updateDriver);
router.delete('/:id', c.deactivateDriver);

module.exports = router;
