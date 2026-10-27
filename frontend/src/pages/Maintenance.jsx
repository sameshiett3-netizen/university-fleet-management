import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtKm, todayISO } from '../utils/format';

function ServiceModal({ vehicles, initial, onClose, onSaved }) {
    const toast = useToast();
    const [form, setForm] = useState({
        vehicle_id: initial?.vehicle_id ?? '',
        service_date: todayISO(),
        odometer_at_service: initial ? String(initial.current_odometer) : '',
        details: '',
    });
    const [busy, setBusy] = useState(false);

    const pickVehicle = (e) => {
        const id = e.target.value;
        const v = vehicles.find((x) => String(x.vehicle_id) === id);
        setForm((f) => ({ ...f, vehicle_id: id, odometer_at_service: v ? String(v.current_odometer) : '' }));
    };
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post('/maintenance/service', {
                vehicle_id: Number(form.vehicle_id),
                service_date: form.service_date,
                odometer_at_service: Number(form.odometer_at_service),
                details: form.details || undefined,
            });
            toast.success('Service logged. The maintenance baseline has been reset.');
            onSaved(Number(form.vehicle_id));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="Log service" onClose={onClose}>
            <form onSubmit={submit} className="form">
                <label className="field">
                    <span>Vehicle</span>
                    <select value={form.vehicle_id} onChange={pickVehicle} required disabled={Boolean(initial)}>
                        <option value="">Select a vehicle</option>
                        {vehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number} - {v.model}</option>)}
                    </select>
                </label>
                <div className="field-row">
                    <label className="field"><span>Service date</span><input type="date" value={form.service_date} max={todayISO()} onChange={set('service_date')} required /></label>
                    <label className="field"><span>Odometer at service (km)</span><input type="number" min="0" step="0.1" value={form.odometer_at_service} onChange={set('odometer_at_service')} required /></label>
                </div>
                <label className="field"><span>Work done</span><textarea rows="3" maxLength={2000} value={form.details} onChange={set('details')} placeholder="e.g. Oil and filter change, brake inspection" /></label>
                <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Log service'}</button>
                </div>
            </form>
        </Modal>
    );
}

export default function Maintenance() {
    const toast = useToast();
    const [alerts, setAlerts] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);           // null | { initial? }
    const [historyId, setHistoryId] = useState('');
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const [a, v] = await Promise.all([api.get('/maintenance/alerts'), api.get('/vehicles')]);
            setAlerts(a.data); setVehicles(v.data);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load maintenance data.'));
        } finally {
            setLoading(false);
        }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!historyId) return undefined;
        let cancelled = false;
        api.get(`/maintenance/service/${historyId}`)
            .then((res) => { if (!cancelled) setHistory(res.data); })
            .catch((error) => { if (!cancelled) toast.error(errorMessage(error, 'Could not load service history.')); })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });
        return () => { cancelled = true; };
    }, [historyId, toast]);

    const chooseHistory = (id) => {
        setHistoryId(id);
        setHistory([]);
        setHistoryLoading(Boolean(id));
    };

    const saved = async (vehicleId) => {
        setModal(null);
        await load();
        chooseHistory(String(vehicleId));
    };

    const closeModal = useCallback(() => setModal(null), []);

    return (
        <>
            <PageHeader title="Maintenance" subtitle="Predictive alerts based on odometer readings">
                <button type="button" className="btn btn-primary" onClick={() => setModal({})}>+ Log service</button>
            </PageHeader>

            {loading ? <Spinner label="Loading maintenance data..." /> : (
                <>
                    <section className="panel">
                        <div className="panel-head"><h2>Active alerts ({alerts.length})</h2></div>
                        <div className="table-wrap flat">
                            <table className="table">
                                <thead><tr><th>Vehicle</th><th>Alert</th><th className="num">Current odometer</th><th className="num">Service due at</th><th className="num">Remaining</th><th /></tr></thead>
                                <tbody>
                                    {alerts.length === 0 && <tr><td colSpan="6" className="empty">No active alerts. All vehicles are within their service intervals.</td></tr>}
                                    {alerts.map((a) => {
                                        const remaining = a.next_service_due - a.current_odometer;
                                        return (
                                            <tr key={a.alert_id}>
                                                <td><strong>{a.plate_number}</strong><div className="muted small">{a.model}</div></td>
                                                <td><StatusBadge value={a.alert_level} /></td>
                                                <td className="num">{fmtKm(a.current_odometer)}</td>
                                                <td className="num">{fmtKm(a.next_service_due)}</td>
                                                <td className="num">{remaining >= 0 ? fmtKm(remaining) : `${fmtKm(-remaining)} over`}</td>
                                                <td className="row-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ initial: a })}>Log service</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="panel">
                        <div className="panel-head">
                            <h2>Service history</h2>
                            <select value={historyId} onChange={(e) => chooseHistory(e.target.value)} aria-label="Vehicle">
                                <option value="">Select a vehicle</option>
                                {vehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number} - {v.model}</option>)}
                            </select>
                        </div>
                        {!historyId ? <p className="muted pad">Choose a vehicle to see its service records.</p>
                            : historyLoading ? <Spinner label="Loading..." />
                            : (
                                <div className="table-wrap flat">
                                    <table className="table">
                                        <thead><tr><th>Date</th><th className="num">Odometer</th><th>Work done</th></tr></thead>
                                        <tbody>
                                            {history.length === 0 && <tr><td colSpan="3" className="empty">No service records yet. The baseline is the odometer reading at registration.</td></tr>}
                                            {history.map((r) => (
                                                <tr key={r.record_id}><td>{fmtDate(r.service_date)}</td><td className="num">{fmtKm(r.odometer_at_service)}</td><td>{r.details || '-'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </section>
                </>
            )}

            {modal && <ServiceModal vehicles={vehicles} initial={modal.initial} onClose={closeModal} onSaved={saved} />}
        </>
    );
}
