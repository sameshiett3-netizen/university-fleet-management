const db = require('../config/db');

// @desc    Add a new vehicle (Admin only)
const addVehicle = async (req, res) => {
    const { plate_number, model, initial_odometer, service_interval_km } = req.body;
    
    try {
        const query = `
            INSERT INTO Vehicles 
            (plate_number, model, initial_odometer, current_odometer, service_interval_km) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        // When registering a vehicle, current_odometer is the same as initial_odometer
        await db.query(query, [plate_number, model, initial_odometer, initial_odometer, service_interval_km]);
        
        res.status(201).json({ message: 'Vehicle added successfully!' });
    } catch (error) {
        console.error(error);
        // Catch duplicate plate numbers
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'A vehicle with this plate number already exists.' });
        }
        res.status(500).json({ error: 'Server error while adding vehicle.' });
    }
};

// @desc    Get all vehicles (Admins & Drivers)
const getVehicles = async (req, res) => {
    try {
        const [vehicles] = await db.query('SELECT * FROM Vehicles ORDER BY created_at DESC');
        res.json(vehicles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error fetching vehicles.' });
    }
};

module.exports = { addVehicle, getVehicles };