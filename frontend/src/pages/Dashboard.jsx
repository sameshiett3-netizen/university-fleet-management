import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, fmtKm } from '../utils/format';

function Card({ label, value, hint, tone = 'green', to }) {
    const body = (
        <div className={`stat stat-${tone}`}>
            <span className="stat-label">{label}</span>
            <span className="stat-value">{value}</span>
            <span className="stat-hint">{hint}</span>
        </div>
    );
    return to ? <Link to={to} className="stat-link">{body}</Link> : body;
}

export default function Dashboard() {
    const toast = useToast();
    const [summary, setSummary] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [s, a, t] = await Promise.all([api.get('/dashboard/summary'), api.get('/maintenance/alerts'), api.get('/trips')]);
            setSummary(s.data); setAlerts(a.data); setTrips(t.data.slice(0, 8));
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load the dashboard.'));
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
        const id = setInterval(load, 30000);
        return () => clearInterval(id);
    }, [load]);

    if (loading) return <Spinner label="Loading dashboard..." />;
    if (!summary) return <p className="muted">The dashboard is unavailable right now.</p>;
    const { vehicles, trips: t, alerts: al, drivers } = summary;

    return (
        <>
            <PageHeader title="Dashboard" subtitle="Fleet status at a glance" />
            <div className="stat-grid">
                <Card label="Active trips" value={t.active} hint={`${t.pending} pending, ${t.approved} approved`} tone="green" to="/admin/tracking" />
                <Card label="Vehicles" value={vehicles.total} hint={`${vehicles.available} available, ${vehicles.in_trip} in trip, ${vehicles.in_maintenance} in maintenance`} tone="blue" to="/admin/vehicles" />
                <Card label="Maintenance alerts" value={al.total} hint={`${al.overdue} overdue, ${al.warning} warning`} tone={al.overdue > 0 ? 'red' : al.total > 0 ? 'amber' : 'green'} to="/admin/maintenance" />
                <Card label="Drivers" value={drivers.total} hint={`${t.completed} trips completed`} tone="dark" to="/admin/drivers" />
            </div>

            <div className="grid-2">
                <section className="panel">
                    <div className="panel-head"><h2>Needs attention</h2><Link to="/admin/maintenance" className="link">View all</Link></div>
                    {alerts.length === 0 ? (
                        <p className="muted pad">All vehicles are within their service intervals.</p>
                    ) : (
                        <ul className="list">
                            {alerts.slice(0, 6).map((a) => (
                                <li key={a.alert_id}>
                                    <div>
                                        <strong>{a.plate_number}</strong> <span className="muted">{a.model}</span>
                                        <div className="muted small">Service due at {fmtKm(a.next_service_due)}; now {fmtKm(a.current_odometer)}</div>
                                    </div>
                                    <StatusBadge value={a.alert_level} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-head"><h2>Recent trips</h2><Link to="/admin/trips" className="link">View all</Link></div>
                    {trips.length === 0 ? (
                        <p className="muted pad">No trips yet.</p>
                    ) : (
                        <ul className="list">
                            {trips.map((x) => (
                                <li key={x.trip_id}>
                                    <div>
                                        <strong>{x.plate_number}</strong> to {x.destination}
                                        <div className="muted small">{x.driver_name} &middot; {fmtDateTime(x.created_at)}</div>
                                    </div>
                                    <StatusBadge value={x.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
