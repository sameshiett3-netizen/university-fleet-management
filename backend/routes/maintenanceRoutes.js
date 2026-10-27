const express = require('express');
const c = require('../controllers/maintenanceController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(verifyToken, requireAdmin);

router.get('/alerts', c.getAlerts);
router.get('/service/:id', c.getServiceHistory);
router.post('/service', c.logService);

module.exports = router;
