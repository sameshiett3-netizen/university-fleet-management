import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, fmtKm } from '../utils/format';

function CompleteModal({ trip, onClose, onDone }) {
    const toast = useToast();
    const [odometer, setOdometer] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const start = Number(trip.start_odometer);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        const value = Number(odometer);
        if (!Number.isFinite(value) || odometer === '') { setError('Enter the final odometer reading.'); return; }
        if (value < start) { setError(`The reading cannot be less than the starting odometer (${fmtKm(start)}).`); return; }
        setBusy(true);
        try {
            await api.put(`/trips/${trip.trip_id}/complete`, { final_odometer: value });
            toast.success('Trip completed. Thank you!');
            onDone();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="Complete trip" onClose={onClose}>
            <form onSubmit={submit} className="form" noValidate>
                <p className="muted">{trip.plate_number} to {trip.destination}</p>
                <div className="info-row"><span>Starting odometer</span><strong>{fmtKm(start)}</strong></div>
                <label className="field">
                    <span>Final odometer reading (km)</span>
                    <input type="number" inputMode="decimal" min={start} step="0.1" value={odometer} onChange={(e) => setOdometer(e.target.value)} autoFocus required />
                </label>
                {error && <div className="alert alert-error" role="alert">{error}</div>}
                <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Complete trip'}</button>
                </div>
            </form>
        </Modal>
    );
}

function TripCard({ trip, onStart, onComplete, busy }) {
    return (
        <article className={`trip-card trip-${trip.status.toLowerCase()}`}>
            <header>
                <h3>{trip.destination}</h3>
                <StatusBadge value={trip.status} />
            </header>
            <dl>
                <div><dt>Vehicle</dt><dd>{trip.plate_number} ({trip.model})</dd></div>
                <div><dt>Assigned</dt><dd>{fmtDateTime(trip.created_at)}</dd></div>
                {trip.start_time && <div><dt>Started</dt><dd>{fmtDateTime(trip.start_time)}</dd></div>}
                {trip.start_odometer !== null && <div><dt>Odometer</dt><dd>{fmtKm(trip.start_odometer)}{trip.final_odometer !== null ? ` to ${fmtKm(trip.final_odometer)}` : ''}</dd></div>}
            </dl>
            {trip.status === 'Approved' && <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => onStart(trip)}>Start trip</button>}
            {trip.status === 'Active' && <button type="button" className="btn btn-primary btn-block" onClick={() => onComplete(trip)}>Complete trip</button>}
            {trip.status === 'Pending' && <p className="muted small">Waiting for the transport office to approve this trip.</p>}
        </article>
    );
}

export default function DriverPortal() {
    const { user } = useAuth();
    const toast = useToast();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [completing, setCompleting] = useState(null);

    const load = useCallback(async () => {
        try {
            setTrips((await api.get('/trips/my-trips')).data);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load your trips.'));
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
        const id = setInterval(load, 20000);
        return () => clearInterval(id);
    }, [load]);

    const start = async (trip) => {
        setBusyId(trip.trip_id);
        try {
            await api.put(`/trips/${trip.trip_id}/start`);
            toast.success('Trip started. Drive safely!');
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
            await load();
        }
    };

    const current = trips.filter((t) => ['Active', 'Approved', 'Pending'].includes(t.status));
    const past = trips.filter((t) => ['Completed', 'Cancelled'].includes(t.status));

    return (
        <div className="driver-portal">
            <div className="page-header">
                <div><h1>My trips</h1><p className="muted">Welcome, {user?.name}</p></div>
                <div className="page-actions"><button type="button" className="btn btn-ghost" onClick={load}>Refresh</button></div>
            </div>

            {loading ? <Spinner label="Loading your trips..." /> : (
                <>
                    <h2 className="section-title">Current</h2>
                    {current.length === 0 ? <p className="muted pad">You have no assigned trips right now.</p> : (
                        <div className="card-grid">
                            {current.map((t) => <TripCard key={t.trip_id} trip={t} onStart={start} onComplete={setCompleting} busy={busyId === t.trip_id} />)}
                        </div>
                    )}
                    {past.length > 0 && (
                        <>
                            <h2 className="section-title">History</h2>
                            <div className="card-grid">
                                {past.map((t) => <TripCard key={t.trip_id} trip={t} />)}
                            </div>
                        </>
                    )}
                </>
            )}

            {completing && <CompleteModal trip={completing} onClose={() => setCompleting(null)} onDone={() => { setCompleting(null); load(); }} />}
        </div>
    );
}
