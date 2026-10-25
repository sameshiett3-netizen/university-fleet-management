import { useState, useEffect } from 'react';
import api from '../api/axios';

// Exhaustive list of major ABU Zaria academic, administrative, residential, and landmark locations
const ABU_LOCATIONS = [
    // Administrative & Major Centers
    "Senate Building",
    "Iya Abubakar Institute of Information and Computer Technology (IAIICT)",
    "Kashim Ibrahim Library (KIL)",
    "Assembly Hall",
    "Mamman Kontagora Square",
    "School of Postgraduate Studies (SPGS)",
    "University Health Services (Sick Bay)",
    "ABU Microfinance Bank",
    "ABU Water Works / Dam",
    "Centre for Energy Research and Training (CERT)",
    "Institute for Agricultural Research (IAR)",
    "National Animal Production Research Institute (NAPRI) - Shika",
    
    // Faculties & Academic Areas (Samaru Main Campus)
    "Faculty of Agriculture",
    "Faculty of Arts",
    "Faculty of Education",
    "Faculty of Engineering",
    "Faculty of Environmental Design",
    "Faculty of Life Sciences",
    "Faculty of Physical Sciences",
    "Faculty of Pharmaceutical Sciences",
    "Faculty of Social Sciences",
    "Faculty of Veterinary Medicine",
    "Ahmadu Bello University Business School (ABUBS)",
    "School of Basic and Remedial Studies (SBRS)",
    
    // Kongo Campus
    "Faculty of Law (Kongo Campus)",
    "Faculty of Administration (Kongo Campus)",
    "Kongo Library",
    "Kongo Conference Hotel",

    // Medical (Shika)
    "ABU Teaching Hospital (ABUTH) - Shika",
    "Faculty of Medicine / College of Medical Sciences",

    // Halls of Residence (Hostels)
    "Amina Hall",
    "Alexander Hall",
    "Ali Akilu Hall",
    "Akenzua Hall",
    "Bedde Hall",
    "Danfodio Hall",
    "ICSA / Ramlat Hall",
    "Ribadu Hall",
    "Sardauna Hall",
    "Suleiman Hall",

    // Gates & External Landmarks
    "Samaru Main Gate",
    "North Gate",
    "Kongo Main Gate",
    "Demonstration Secondary School (ABUDSS)",
    "ABU Staff School",
    "Aminu Bashir Mosque",
    "St. Andrew's Catholic Church",
    "Protestant Chapel"
];

export default function TripDispatch() {
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    
    // Autocomplete State
    const [destination, setDestination] = useState('');
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const fetchAvailableVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(res.data.filter(v => v.status === 'Available'));
        } catch (error) {
            console.error('Failed to fetch vehicles', error);
        }
    };

    useEffect(() => {
        fetchAvailableVehicles();
    }, []);

    // Handle typing in the destination field
    const handleDestinationChange = (e) => {
        const userInput = e.target.value;
        setDestination(userInput);

        if (userInput.trim() === '') {
            setFilteredSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Filter locations (case-insensitive)
        const matches = ABU_LOCATIONS.filter(
            (location) => location.toLowerCase().includes(userInput.toLowerCase())
        );

        setFilteredSuggestions(matches);
        setShowSuggestions(true);
    };

    // Handle clicking a suggestion from the dropdown
    const selectSuggestion = (suggestion) => {
        setDestination(suggestion);
        setFilteredSuggestions([]);
        setShowSuggestions(false);
    };

    const handleDispatch = async (e) => {
        e.preventDefault();
        try {
            await api.post('/trips', {
                vehicle_id: selectedVehicle,
                driver_id: 1, // Hardcoded System Driver for the prototype
                destination: destination
            });
            
            alert('Trip created successfully! Vehicle is now dispatched.');
            setSelectedVehicle('');
            setDestination('');
            setFilteredSuggestions([]);
            setShowSuggestions(false);
            fetchAvailableVehicles(); // Refresh dropdown
        } catch (error) {
            alert('Error creating trip');
        }
    };

    return (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Dispatch Vehicle</h3>
            <form onSubmit={handleDispatch} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                
                <select 
                    value={selectedVehicle} 
                    onChange={e => setSelectedVehicle(e.target.value)} 
                    required 
                    style={{ padding: '8px', border: '1px solid #ccc', flex: 1, borderRadius: '4px', height: '37px' }}
                >
                    <option value="">Select Available Vehicle...</option>
                    {vehicles.map(v => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number} ({v.model})</option>
                    ))}
                </select>

                {/* Autocomplete Wrapper */}
                <div style={{ position: 'relative', display: 'inline-block', flex: 1 }}>
                    <input 
                        type="text" 
                        placeholder="Destination (e.g., Senate Building)" 
                        value={destination} 
                        onChange={handleDestinationChange} 
                        required 
                        style={{ padding: '8px', border: '1px solid #ccc', width: '100%', borderRadius: '4px', boxSizing: 'border-box', height: '37px' }} 
                        autoComplete="off"
                    />
                    
                    {/* The Dropdown Menu */}
                    {showSuggestions && destination && filteredSuggestions.length > 0 && (
                        <ul style={{
                            position: 'absolute', 
                            top: '100%', 
                            left: 0, 
                            right: 0,
                            border: '1px solid #ccc', 
                            borderTop: 'none',
                            backgroundColor: '#fff',
                            listStyle: 'none', 
                            margin: 0, 
                            padding: 0, 
                            zIndex: 1000,
                            maxHeight: '200px', 
                            overflowY: 'auto',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            borderRadius: '0 0 4px 4px'
                        }}>
                            {filteredSuggestions.map((suggestion, index) => (
                                <li
                                    key={index}
                                    onClick={() => selectSuggestion(suggestion)}
                                    style={{ 
                                        padding: '10px', 
                                        cursor: 'pointer', 
                                        borderBottom: index === filteredSuggestions.length - 1 ? 'none' : '1px solid #eee',
                                        fontSize: '14px'
                                    }}
                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f8ff'}
                                    onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#0056b3', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', height: '37px' }}>
                    Launch Trip
                </button>
            </form>
        </div>
    );
}