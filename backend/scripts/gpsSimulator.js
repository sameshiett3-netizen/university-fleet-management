// GPS simulator: a stand-alone client that drives every Active trip from the Fleet Garage to its destination
// and posts a coordinate every few seconds to POST /api/tracking/location (authenticated by SIMULATOR_SECRET).
// It never touches the database: trip completion and odometer updates belong to the driver (via the API).
const { config, assertSecrets } = require('../config/env');
const { GARAGE } = require('../config/locations');

assertSecrets();

const API_URL = process.env.API_URL || `http://localhost:${config.port}/api`;
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS) || 2000;
const USE_OSRM = process.env.SIMULATOR_USE_OSRM !== 'false';
const headers = { 'Content-Type': 'application/json', 'X-Simulator-Secret': config.simulatorSecret };

const running = new Set();     // trips currently being simulated
const activeNow = new Set();   // trips the API currently reports as Active
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a, b) {
    const R = 6371; const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// Road route from the public OSRM server; falls back to a straight line when offline so demos never stall.
async function getRoute(from, to) {
    if (USE_OSRM) {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            const data = await res.json();
            if (data.routes && data.routes[0]) {
                return { points: data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), distanceKm: data.routes[0].distance / 1000, source: 'OSRM road route' };
            }
        } catch (_) { /* fall through to the straight-line route */ }
    }
    const steps = 60;
    const points = Array.from({ length: steps + 1 }, (_, i) => ({ lat: from.lat + ((to.lat - from.lat) * i) / steps, lng: from.lng + ((to.lng - from.lng) * i) / steps }));
    return { points, distanceKm: haversineKm(from, to), source: 'straight-line fallback' };
}

async function simulateTrip(trip) {
    const id = trip.trip_id;
    try {
        if (!trip.destination_coords) { console.log(`Trip ${id}: destination "${trip.destination}" has no coordinates; skipping.`); return; }
        const route = await getRoute(GARAGE, trip.destination_coords);
        console.log(`Trip ${id}: driving to ${trip.destination} (${route.points.length} points, ${route.distanceKm.toFixed(2)} km, ${route.source}).`);

        for (const p of route.points) {
            if (!activeNow.has(id)) { console.log(`Trip ${id} is no longer active; stopping.`); return; }
            const res = await fetch(`${API_URL}/tracking/location`, { method: 'POST', headers, body: JSON.stringify({ trip_id: id, latitude: p.lat, longitude: p.lng }) });
            if (res.status === 409 || res.status === 404) { console.log(`Trip ${id} was closed by the server; stopping.`); return; }
            if (!res.ok) console.error(`Trip ${id}: server answered ${res.status}`);
            await sleep(INTERVAL_MS);
        }
        console.log(`Trip ${id}: arrived at ${trip.destination}. Route distance ${route.distanceKm.toFixed(2)} km. The driver can now complete the trip with the final odometer reading.`);
        // Stay "running" until the trip leaves the Active list so it is not replayed
        while (activeNow.has(id)) await sleep(INTERVAL_MS);
    } catch (error) {
        console.error(`Trip ${id}: simulation error: ${error.message}`);
    } finally {
        running.delete(id);
    }
}

async function poll() {
    try {
        const res = await fetch(`${API_URL}/tracking/simulator/trips`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const trips = await res.json();
        activeNow.clear();
        for (const t of trips) {
            activeNow.add(t.trip_id);
            if (!running.has(t.trip_id)) { running.add(t.trip_id); simulateTrip(t); }
        }
    } catch (error) {
        console.error(`Cannot reach the API at ${API_URL}: ${error.message}`);
    }
}

console.log(`GPS simulator started. API: ${API_URL}. Waiting for Active trips...`);
poll();
setInterval(poll, 4000);
