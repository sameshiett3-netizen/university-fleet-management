// Campus destinations the simulator and the dispatch form can use.
// Add further places here ({ name: { lat, lng } }); the frontend reads this list through GET /api/locations.
const LOCATIONS = {
    'Senate Building': { lat: 11.1534, lng: 7.6523 },
    'Samaru Main Gate': { lat: 11.1598, lng: 7.6439 },
    'University Health Services (Sick Bay)': { lat: 11.1492, lng: 7.6471 },
    'Kashim Ibrahim Library (KIL)': { lat: 11.1528, lng: 7.6465 },
    'Danfodio Hall': { lat: 11.1539, lng: 7.6465 },
    'Faculty of Engineering': { lat: 11.1505, lng: 7.6490 },
    'Faculty of Arts': { lat: 11.1545, lng: 7.6480 },
    'Amina Hall': { lat: 11.1510, lng: 7.6440 },
    'Faculty of Law (Kongo Campus)': { lat: 11.1130, lng: 7.6320 },
    'Mamman Kontagora Square': { lat: 11.1520, lng: 7.6495 },
    'Iya Abubakar Institute of Information and Computer Technology (IAIICT)': { lat: 11.1515, lng: 7.6510 },
};

// Starting point of every simulated trip
const GARAGE = { name: 'Fleet Garage', lat: 11.1580, lng: 7.6450 };

module.exports = { LOCATIONS, GARAGE };
