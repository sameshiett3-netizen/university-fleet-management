const express = require('express');
const c = require('../controllers/tripController');
const { verifyToken, requireAdmin, requireDriver } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(verifyToken);

// Administrator
router.get('/', requireAdmin, c.getTrips);
router.post('/', requireAdmin, c.createTrip);
router.put('/:id/approve', requireAdmin, c.approveTrip);
router.put('/:id/cancel', requireAdmin, c.cancelTrip);
router.put('/:id/terminate', requireAdmin, c.terminateTrip);

// Driver
router.get('/my-trips', requireDriver, c.getMyTrips);
router.put('/:id/start', requireDriver, c.startTrip);
router.put('/:id/complete', requireDriver, c.completeTrip);

module.exports = router;
