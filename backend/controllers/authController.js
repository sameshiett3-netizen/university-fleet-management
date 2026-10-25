const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const login = async (req, res) => {
    const { email, password } = req.body;
    
    // Guard: Prevent crash if frontend sends empty data
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // 1. Check if user exists
        const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users[0];

        // 2. Compare the hashed password (FIXED: matching the exact database column name)
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 3. Generate the JSON Web Token (JWT)
        const token = jwt.sign(
            { id: user.user_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 4. Send token in an HttpOnly cookie (protects against XSS attacks)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // FIXED: Proper math syntax for 8 hours
        });

        // 5. Send back basic user data for the frontend dashboard
        res.json({ 
            message: 'Login successful', 
            user: { id: user.user_id, name: user.name, role: user.role } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

const logout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
};

module.exports = { login, logout };