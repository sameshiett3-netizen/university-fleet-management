import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api, { errorMessage } from '../api/axios';
import { createSocket } from '../api/socket';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { useToast } from '../context/ToastContext';

const CENTER = [11.1522, 7.6534]; // Ahmadu Bello University, Zaria
const destinationIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
const vehicleIcon = (plate) => L.divIcon({
    className: 'vehicle-marker',
    html: `<div class="vehicle-pin"><span></span>${plate.replace(/[<>&"]/g, '')}</div>`,
    iconSize: [96, 28],
    iconAnchor: [48, 14],
});

function FlyTo({ target }) {
    const map = useMap();
    useEffect(() => { if (target) map.flyTo(target, 16, { duration: 0.8 }); }, [target, map]);
    return null;
}

export default function LiveTracking() {
    const toast = useToast();
    const [trips, setTrips] = useState({});          // trip_id -> trip with path and position
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const knownRef = useRef(new Set());

    const load = useCallback(async () => {
        try {
            const res = await api.get('/tracking/active');
            const next = {};
            for (const t of res.data) {
                const last = t.path[t.path.length - 1];
                next[t.trip_id] = { ...t, position: last || null };
            }
            knownRef.current = new Set(Object.keys(next).map(Number));
            setTrips(next);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load active trips.'));
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
        const socket = createSocket();
        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => setConnected(false));

        socket.on('vehicle_location_update', (d) => {
            if (!knownRef.current.has(d.trip_id)) { knownRef.current.add(d.trip_id); load(); return; }
            setTrips((prev) => {
                const t = prev[d.trip_id];
                if (!t) return prev;
                const point = [d.latitude, d.longitude];
                return { ...prev, [d.trip_id]: { ...t, position: point, path: [...t.path, point] } };
            });
        });
        socket.on('TRIP_STARTED', load);
        const remove = (id) => setTrips((prev) => { const c = { ...prev }; delete c[id]; knownRef.current.delete(id); return c; });
        socket.on('TRIP_COMPLETED', (d) => { remove(d.trip_id); toast.success(`${d.plate_number || 'Vehicle'} completed its trip to ${d.destination}.`); });
        socket.on('TRIP_TERMINATED', (d) => remove(d.trip_id));
        return () => socket.disconnect();
    }, [load, toast]);

    const abort = async (trip) => {
        if (!window.confirm(`Abort the trip of ${trip.plate_number} to ${trip.destination}? The vehicle will be released.`)) return;
        try {
            await api.put(`/trips/${trip.trip_id}/terminate`);
            toast.success('Trip aborted and vehicle released.');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not abort the trip.'));
        }
    };

    const list = Object.values(trips);

    return (
        <>
            <PageHeader title="Live Tracking" subtitle="Vehicles currently on a trip">
                <span className={`live-pill ${connected ? 'on' : 'off'}`}><i />{connected ? 'Live' : 'Reconnecting...'}</span>
            </PageHeader>
            {loading ? <Spinner label="Loading map..." /> : (
                <div className="tracking">
                    <div className="map-wrap">
                        <MapContainer center={CENTER} zoom={14} scrollWheelZoom>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
                            <FlyTo target={flyTarget} />
                            {list.map((t) => (
                                <Fragment key={t.trip_id}>
                                    {t.path.length > 1 && <Polyline positions={t.path} pathOptions={{ color: '#006633', weight: 4, opacity: 0.75 }} />}
                                    {t.destination_coords && (
                                        <Marker position={[t.destination_coords.lat, t.destination_coords.lng]} icon={destinationIcon}>
                                            <Popup><strong>Destination</strong><br />{t.destination}<br />Trip #{t.trip_id}</Popup>
                                        </Marker>
                                    )}
                                    {t.position && (
                                        <Marker position={t.position} icon={vehicleIcon(t.plate_number)}>
                                            <Popup>
                                                <strong>{t.plate_number}</strong> ({t.model})<br />
                                                Driver: {t.driver_name}<br />
                                                To: {t.destination}<br />
                                                <button type="button" className="btn btn-danger btn-sm popup-btn" onClick={() => abort(t)}>Abort trip</button>
                                            </Popup>
                                        </Marker>
                                    )}
                                </Fragment>
                            ))}
                        </MapContainer>
                    </div>
                    <aside className="panel tracking-list">
                        <div className="panel-head"><h2>Active trips ({list.length})</h2></div>
                        {list.length === 0 ? (
                            <p className="muted pad">No vehicle is on a trip. Start the GPS simulator after a driver starts a trip to see it here.</p>
                        ) : (
                            <ul className="list">
                                {list.map((t) => (
                                    <li key={t.trip_id}>
                                        <div>
                                            <strong>{t.plate_number}</strong>
                                            <div className="muted small">{t.driver_name} &rarr; {t.destination}</div>
                                            {!t.position && <div className="muted small">Waiting for first GPS fix...</div>}
                                        </div>
                                        <div className="row-actions">
                                            {t.position && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlyTarget([...t.position])}>Locate</button>}
                                            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => abort(t)}>Abort</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>
                </div>
            )}
        </>
    );
}
