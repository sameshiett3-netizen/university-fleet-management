import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, fmtKm } from '../utils/format';

const TABS = ['All', 'Pending', 'Approved', 'Active', 'Completed', 'Cancelled'];

function NewTripModal({ onClose, onCreated }) {
    const toast = useToast();
    const [vehicles, setVehicles] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [form, setForm] = useState({ vehicle_id: '', driver_id: '', destination: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([api.get('/vehicles', { params: { status: 'Available' } }), api.get('/drivers'), api.get('/locations')])
            .then(([v, d, l]) => { if (!cancelled) { setVehicles(v.data); setDrivers(d.data); setLocations(l.data); } })
            .catch((error) => { if (!cancelled) { toast.error(errorMessage(error, 'Could not load the form data.')); onClose(); } });
        return () => { cancelled = true; };
    }, [toast, onClose]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/trips', { vehicle_id: Number(form.vehicle_id), driver_id: Number(form.driver_id), destination: form.destination });
            toast.success('Trip created. Approve it so the driver can start it.');
            onCreated();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="New trip" onClose={onClose}>
            {!vehicles ? <Spinner label="Loading..." /> : (
                <form onSubmit={submit} className="form">
                    <label className="field">
                        <span>Vehicle</span>
                        <select value={form.vehicle_id} onChange={set('vehicle_id')} required>
                            <option value="">Select an available vehicle</option>
                            {vehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number} - {v.model}</option>)}
                        </select>
                        {vehicles.length === 0 && <small className="muted">No vehicle is currently available.</small>}
                    </label>
                    <label className="field">
                        <span>Driver</span>
                        <select value={form.driver_id} onChange={set('driver_id')} required>
                            <option value="">Select a driver</option>
                            {drivers.map((d) => <option key={d.user_id} value={d.user_id}>{d.name}</option>)}
                        </select>
                        {drivers.length === 0 && <small className="muted">Add a driver first.</small>}
                    </label>
                    <label className="field">
                        <span>Destination</span>
                        <select value={form.destination} onChange={set('destination')} required>
                            <option value="">Select a destination</option>
                            {locations.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                        </select>
                    </label>
                    <div className="form-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating...' : 'Create trip'}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

export default function Trips() {
    const toast = useToast();
    const [tab, setTab] = useState('All');
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/trips', { params: tab === 'All' ? {} : { status: tab } });
            setTrips(res.data);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load trips.'));
        } finally {
            setLoading(false);
        }
    }, [tab, toast]);

    useEffect(() => {
        load();
        const id = setInterval(load, 20000);
        return () => clearInterval(id);
    }, [load]);

    const act = async (trip, action, okMessage, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return;
        try {
            await api.put(`/trips/${trip.trip_id}/${action}`);
            toast.success(okMessage);
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
            await load();
        }
    };

    const closeModal = useCallback(() => setCreating(false), []);

    return (
        <>
            <PageHeader title="Trips" subtitle="Dispatch and track trip requests">
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>+ New trip</button>
            </PageHeader>

            <div className="tabs" role="tablist">
                {TABS.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setLoading(true); setTab(t); }}>{t}</button>
                ))}
            </div>

            {loading ? <Spinner label="Loading trips..." /> : (
                <div className="table-wrap">
                    <table className="table">
                        <thead><tr><th>#</th><th>Vehicle</th><th>Driver</th><th>Destination</th><th>Status</th><th className="num">Odometer</th><th>Created</th><th /></tr></thead>
                        <tbody>
                            {trips.length === 0 && <tr><td colSpan="8" className="empty">No trips found.</td></tr>}
                            {trips.map((t) => (
                                <tr key={t.trip_id}>
                                    <td>{t.trip_id}</td>
                                    <td><strong>{t.plate_number}</strong><div className="muted small">{t.model}</div></td>
                                    <td>{t.driver_name}</td>
                                    <td>{t.destination}</td>
                                    <td><StatusBadge value={t.status} /></td>
                                    <td className="num">{t.start_odometer !== null ? fmtKm(t.start_odometer) : '-'}{t.final_odometer !== null && <div className="muted small">to {fmtKm(t.final_odometer)}</div>}</td>
                                    <td>{fmtDateTime(t.created_at)}</td>
                                    <td className="row-actions">
                                        {t.status === 'Pending' && <button type="button" className="btn btn-primary btn-sm" onClick={() => act(t, 'approve', 'Trip approved.')}>Approve</button>}
                                        {(t.status === 'Pending' || t.status === 'Approved') && <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => act(t, 'cancel', 'Trip cancelled.', `Cancel trip #${t.trip_id}?`)}>Cancel</button>}
                                        {t.status === 'Active' && <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => act(t, 'terminate', 'Trip aborted and vehicle released.', `Abort the active trip of ${t.plate_number}? The vehicle will be released.`)}>Abort</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {creating && <NewTripModal onClose={closeModal} onCreated={() => { setCreating(false); setLoading(true); load(); }} />}
        </>
    );
}
