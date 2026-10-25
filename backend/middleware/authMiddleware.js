const jwt = require('jsonwebtoken');

// 1. Verify if the user is logged in
const verifyToken = (req, res, next) => {
    // Grab the token from the HttpOnly cookie
    const token = req.cookies.token;

    if (!token) {
        return res.status(403).json({ error: 'Access denied. No token provided.' });
    }

    try {
        // Crack open the token to see who is making the request
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach the user data (id, role) to the request
        next(); // Let them pass to the actual route
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

// 2. Verify if the user specifically has Admin privileges
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Admin privileges required.' });
    }
    next();
};

module.exports = { verifyToken, requireAdmin };