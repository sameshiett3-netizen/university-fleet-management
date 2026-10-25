require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const query = `INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)`;
        await db.query(query, ['System Admin', 'admin@abu.edu.ng', hashedPassword, 'Admin']);
        
        console.log('✅ Admin user created successfully!');
        process.exit();
    } catch (error) {
        console.error('❌ Error seeding admin:', error);
        process.exit(1);
    }
}

seedAdmin();