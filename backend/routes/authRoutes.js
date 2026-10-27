const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, session, logout } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Slows down password guessing (disabled while running the automated tests)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

router.post('/login', loginLimiter, login);
router.get('/session', verifyToken, session);
router.post('/logout', logout);

module.exports = router;
