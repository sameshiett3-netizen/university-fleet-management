import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import io from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Hardcoded exact GPS coordinates for ABU Zaria landmarks
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
    "Fleet Garage": { lat: 11.1580, lng: 7.6450 } 
};

// Leaflet marker fix
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

export default function LiveMap() {
    const [markers, setMarkers] = useState({});
    const [destinations, setDestinations] = useState({}); // Stores destination markers
    const [paths, setPaths] = useState({}); // Stores coordinate history for the Polyline trail
    const [notification, setNotification] = useState(''); // State for arrival notification banner
    
    // Centered accurately on Ahmadu Bello University, Zaria
    const defaultPosition = [11.1522, 7.6534]; 

    // Handle aborting/terminating an active trip from the map
    const handleTerminateTrip = async (trip_id) => {
        if (!window.confirm(`Are you sure you want to abort Trip ${trip_id}?`)) return;

        try {
            const response = await fetch(`http://localhost:5000/api/trips/${trip_id}/terminate`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                // Immediately remove marker, destination, and path from state
                setMarkers(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
                setDestinations(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
                setPaths(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
                alert(`Trip ${trip_id} successfully aborted and vehicle freed.`);
            } else {
                const errData = await response.json();
                alert(`Failed to terminate trip: ${errData.error || 'Unauthorized or error'}`);
            }
        } catch (error) {
            console.error("Trip termination network error:", error);
            alert("Network error while attempting to terminate trip.");
        }
    };

    useEffect(() => {
        // Connect to your Node.js backend WebSockets
        const socket = io('http://localhost:5000');

        socket.on('vehicle_location_update', (data) => {
            const { trip_id, latitude, longitude, destination } = data;

            // Update current marker position
            setMarkers(prev => ({
                ...prev,
                [trip_id]: { lat: latitude, lng: longitude }
            }));

            // Set destination marker if destination name is provided and exists in coordinates dictionary
            if (destination && ABU_COORDS[destination]) {
                setDestinations(prev => ({
                    ...prev,
                    [trip_id]: { name: destination, ...ABU_COORDS[destination] }
                }));
            }

            // Append coordinates to the path history array for the trail line
            setPaths(prev => ({
                ...prev,
                [trip_id]: [...(prev[trip_id] || []), [latitude, longitude]]
            }));
        });

        // Listen for trip completion broadcast from backend
        socket.on('TRIP_COMPLETED', (data) => {
            const { trip_id, vehicle_id, destination } = data;
            
            // Show notification banner
            setNotification(`🏁 Vehicle (ID: ${vehicle_id}) has successfully arrived at ${destination}! Odometer updated.`);

            // Clear markers and paths for completed trip
            setMarkers(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
            setDestinations(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
            setPaths(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });

            // Automatically hide notification after 7 seconds
            setTimeout(() => {
                setNotification('');
            }, 7000);
        });

        // Listen for trip termination broadcast from backend
        socket.on('TRIP_TERMINATED', (data) => {
            const { trip_id } = data;
            setMarkers(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
            setDestinations(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
            setPaths(prev => { const copy = { ...prev }; delete copy[trip_id]; return copy; });
        });

        return () => socket.disconnect();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Arrival Notification Banner */}
            {notification && (
                <div style={{ 
                    backgroundColor: '#d4edda', 
                    color: '#155724', 
                    padding: '12px 15px', 
                    borderRadius: '6px', 
                    border: '1px solid #c3e6cb',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease'
                }}>
                    {notification}
                </div>
            )}

            <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <MapContainer center={defaultPosition} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />

                    {/* Render the breadcrumb trail (Polyline) behind the moving vehicle */}
                    {Object.entries(paths).map(([trip_id, coordArray]) => (
                        <Polyline 
                            key={`path-${trip_id}`} 
                            positions={coordArray} 
                            color="#0056b3" 
                            weight={4} 
                            opacity={0.7} 
                        />
                    ))}

                    {/* Render the target destination marker */}
                    {Object.entries(destinations).map(([trip_id, dest]) => (
                        <Marker key={`dest-${trip_id}`} position={[dest.lat, dest.lng]}>
                            <Popup>
                                <strong>Destination: {dest.name}</strong><br/>
                                Trip ID: {trip_id}
                            </Popup>
                        </Marker>
                    ))}

                    {/* Render the live moving vehicle marker with Abort Button */}
                    {Object.entries(markers).map(([trip_id, pos]) => (
                        <Marker key={`marker-${trip_id}`} position={[pos.lat, pos.lng]}>
                            <Popup>
                                <strong>Trip ID: {trip_id}</strong><br/>
                                Status: In Transit<br/>
                                Lat: {pos.lat.toFixed(4)}, Lng: {pos.lng.toFixed(4)}<br/><br/>
                                <button 
                                    onClick={() => handleTerminateTrip(trip_id)}
                                    style={{ 
                                        backgroundColor: '#dc3545', 
                                        color: 'white', 
                                        border: 'none', 
                                        padding: '6px 12px', 
                                        borderRadius: '4px', 
                                        cursor: 'pointer', 
                                        fontWeight: 'bold',
                                        width: '100%'
                                    }}
                                >
                                    Abort Journey
                                </button>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}