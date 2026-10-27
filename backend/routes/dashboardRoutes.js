const express = require('express');
const { getSummary } = require('../controllers/dashboardController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/summary', verifyToken, requireAdmin, getSummary);

module.exports = router;
