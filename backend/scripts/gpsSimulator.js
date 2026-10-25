require('dotenv').config();
const mysql = require('mysql2/promise');

const SIMULATOR_SECRET = process.env.SIMULATOR_SECRET;

// 1. Hardcoded exact GPS coordinates for ABU Zaria landmarks
const ABU_COORDS = {
    "Senate Building": { lat: 11.1534, lng: 7.6523 },
    "Samaru Main Gate": { lat: 11.1598, lng: 7.6439 },
    "University Health Services (Sick Bay)": { lat: 11.1492, lng: 7.6471 },
    "Kashim Ibrahim Library (KIL)": { lat: 11.1528, lng: 7.6465 },
    "Danfodio Hall": { lat: 11.1539, lng: 7.6465 },
    "Faculty of Engineering": { lat: 11.1505, lng: 7.6490 },
    "Faculty of Arts": { lat: 11.1545, lng: 7.6480 },
    "Amina Hall": { lat: 11.1510, lng: 7.6440 },
    "Faculty of Law (Kongo Campus)": { lat: 11.1130, lng: 7.6320 },
    "Mamman Kontagora Square": { lat: 11.1520, lng: 7.6495 },
    "Iya Abubakar Institute of Information and Computer Technology (IAIICT)": { lat: 11.1515, lng: 7.6510 },
    // Default starting point for idle vehicles
    "Fleet Garage": { lat: 11.1580, lng: 7.6450 } 
};

const activeSimulations = new Set();

async function getRoadRoute(start, end) {
    try {
        const url = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        
        return {
            coordinates: data.routes[0].geometry.coordinates,
            distanceKm: data.routes[0].distance / 1000 // Convert meters to kilometers
        };
    } catch (error) {
        console.error("OSRM Routing Error:", error.message);
        return { coordinates: [], distanceKm: 0 };
    }
}

async function runSimulator() {
    const db = await mysql.createConnection({
        host: '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'fleet_db',
        port: 3307
    });

    console.log('📡 Smart GPS Simulator connected. Scanning for active trips...');

    async function simulateTrip(tripId, destinationName) {
        const startCoords = ABU_COORDS["Fleet Garage"];
        const endCoords = ABU_COORDS[destinationName] || ABU_COORDS["Samaru Main Gate"]; 

        console.log(`🗺️ Calculating road route for Trip ${tripId} to ${destinationName}...`);
        
        const routeData = await getRoadRoute(startCoords, endCoords);
        const roadPoints = routeData.coordinates;
        const tripDistanceKm = routeData.distanceKm;

        if (!roadPoints || roadPoints.length === 0) {
            activeSimulations.delete(tripId);
            return;
        }

        console.log(`🚗 Route found! Trip ${tripId} is on the move. (${roadPoints.length} road coordinates, Distance: ${tripDistanceKm.toFixed(2)} km)`);

        // Mark trip as In Progress in DB so it doesn't get re-scanned
        await db.execute('UPDATE trips SET status = "In Progress" WHERE trip_id = ?', [tripId]);

        for (let i = 0; i < roadPoints.length; i++) {
            // Check if trip was terminated/cancelled mid-route from the dashboard
            try {
                const [checkRows] = await db.execute('SELECT status FROM trips WHERE trip_id = ?', [tripId]);
                if (checkRows.length === 0 || checkRows[0].status === 'Cancelled') {
                    console.log(`🛑 Trip ${tripId} was cancelled/terminated mid-route. Stopping simulation.`);
                    activeSimulations.delete(tripId);
                    return;
                }
            } catch (err) {
                console.error("Mid-route status check error:", err.message);
            }

            const [lng, lat] = roadPoints[i];

            try {
                const response = await fetch('http://localhost:5000/api/telemetry/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trip_id: tripId,
                        latitude: lat,
                        longitude: lng,
                        destination: destinationName,
                        secret: SIMULATOR_SECRET
                    })
                });

                if (response.ok) {
                    console.log(`📍 Broadcasted Trip ${tripId}: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`);
                }
            } catch (error) {
                console.error(`Trip ${tripId} transmission failed.`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`🏁 Trip ${tripId} has arrived at ${destinationName}! (+${tripDistanceKm.toFixed(2)} km)`);
        
        // 1. Mark trip as Completed in the database
        await db.execute('UPDATE trips SET status = "Completed" WHERE trip_id = ?', [tripId]);

        // 2. Fetch vehicle_id for this trip and increment its odometer
        const [tripRows] = await db.execute('SELECT vehicle_id FROM trips WHERE trip_id = ?', [tripId]);
        if (tripRows.length > 0) {
            const vehicleId = tripRows[0].vehicle_id;
            await db.execute('UPDATE vehicles SET odometer = odometer + ? WHERE vehicle_id = ?', [tripDistanceKm, vehicleId]);
            console.log(`🔧 Vehicle ID ${vehicleId} odometer successfully updated (+${tripDistanceKm.toFixed(2)} km).`);

            // --- PREDICTIVE MAINTENANCE THRESHOLD CHECK ---
            const MAINTENANCE_INTERVAL = 5000;
            const [vehicleRows] = await db.execute('SELECT odometer FROM vehicles WHERE vehicle_id = ?', [vehicleId]);

            if (vehicleRows.length > 0) {
                const currentOdometer = vehicleRows[0].odometer;
                
                // Check if crossing a new 5,000 km threshold
                if (currentOdometer > 0 && Math.floor(currentOdometer / MAINTENANCE_INTERVAL) > Math.floor((currentOdometer - tripDistanceKm) / MAINTENANCE_INTERVAL)) {
                    const issueDesc = `Scheduled Service: Odometer reached milestone of ${currentOdometer.toFixed(1)} km.`;
                    
                    await db.execute(
                        'INSERT INTO maintenance_alerts (vehicle_id, trigger_mileage, issue_description, status) VALUES (?, ?, ?, "Pending")',
                        [vehicleId, currentOdometer, issueDesc]
                    );
                    console.log(`⚠️ Predictive Maintenance Alert Generated for Vehicle ${vehicleId}`);
                }
            }
            // ---------------------------------------------

            // 3. Notify backend server via HTTP to broadcast arrival via WebSockets
            try {
                await fetch('http://localhost:5000/api/telemetry/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        trip_id: tripId, 
                        vehicle_id: vehicleId, 
                        destination: destinationName, 
                        secret: SIMULATOR_SECRET 
                    })
                });
            } catch (err) {
                console.error("Failed to broadcast trip completion:", err.message);
            }
        }

        activeSimulations.delete(tripId);
    }

    // Check database every 5 seconds ONLY for new/pending trips
    setInterval(async () => {
        try {
            const [trips] = await db.execute('SELECT * FROM trips WHERE status IN ("Active", "Pending", "active", "pending")');
            
            for (const trip of trips) {
                if (!activeSimulations.has(trip.trip_id)) {
                    activeSimulations.add(trip.trip_id); 
                    simulateTrip(trip.trip_id, trip.destination);
                }
            }
        } catch (error) {
            console.error("Database scan error:", error.message);
        }
    }, 5000);
} 

runSimulator();