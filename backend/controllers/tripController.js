const db = require('../config/db');
const { evaluateMaintenance } = require('../utils/maintenanceEngine');

// Create a new trip request
const createTrip = async (req, res) => {
    const { vehicle_id, driver_id, destination } = req.body;
    try {
        await db.query(
            'INSERT INTO Trips (vehicle_id, driver_id, destination) VALUES (?, ?, ?)',
            [vehicle_id, driver_id, destination]
        );
        res.status(201).json({ message: 'Trip requested successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create trip.' });
    }
};

// Update Trip State (Pending -> Approved -> Active -> Completed)
const updateTripState = async (req, res) => {
    const { trip_id } = req.params;
    const { status, final_odometer } = req.body;
    
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // If completing a trip, enforce atomic transaction with odometer validation
        if (status === 'Completed') {
            if (!final_odometer) throw new Error('Final odometer reading is required to complete a trip.');
            
            // Lock the vehicle row and get current stats
            const [trips] = await connection.query('SELECT vehicle_id FROM Trips WHERE trip_id = ?', [trip_id]);
            const vehicle_id = trips[0].vehicle_id;
            
            const [vehicles] = await connection.query('SELECT current_odometer FROM Vehicles WHERE vehicle_id = ? FOR UPDATE', [vehicle_id]);
            
            if (final_odometer < vehicles[0].current_odometer) {
                throw new Error('Final odometer cannot be less than current odometer.');
            }

            // 1. Update Trip
            await connection.query(
                'UPDATE Trips SET status = ?, final_odometer = ?, end_time = NOW() WHERE trip_id = ?',
                [status, final_odometer, trip_id]
            );
            
            // 2. Update Vehicle Odometer and Status
            await connection.query(
                'UPDATE Vehicles SET current_odometer = ?, status = "Available" WHERE vehicle_id = ?',
                [final_odometer, vehicle_id]
            );

            // 3. Trigger Predictive Maintenance Algorithm
            await evaluateMaintenance(vehicle_id, connection);
            
        } else if (status === 'Active') {
            await connection.query('UPDATE Trips SET status = ?, start_time = NOW() WHERE trip_id = ?', [status, trip_id]);
            await connection.query('UPDATE Vehicles SET status = "In Trip" WHERE vehicle_id = (SELECT vehicle_id FROM Trips WHERE trip_id = ?)', [trip_id]);
        } else {
            // Pending -> Approved
            await connection.query('UPDATE Trips SET status = ? WHERE trip_id = ?', [status, trip_id]);
        }

        await connection.commit();
        res.json({ message: `Trip status updated to ${status}` });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message || 'Failed to update trip.' });
    } finally {
        connection.release();
    }
};

module.exports = { createTrip, updateTripState };