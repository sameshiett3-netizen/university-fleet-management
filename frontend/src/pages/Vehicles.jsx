import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { fmtKm } from '../utils/format';

const EMPTY = { plate_number: '', model: '', initial_odometer: '', service_interval_km: '5000' };

export default function Vehicles() {
    const toast = useToast();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [form, setForm] = useState(null);   // null = closed; { id?, ...fields }
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setVehicles((await api.get('/vehicles')).data);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load vehicles.'));
        } finally {
            setLoading(false);
        }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? vehicles.filter((v) => v.plate_number.toLowerCase().includes(q) || v.model.toLowerCase().includes(q)) : vehicles;
    }, [vehicles, query]);

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (form.vehicle_id) {
                await api.put(`/vehicles/${form.vehicle_id}`, { plate_number: form.plate_number, model: form.model, service_interval_km: Number(form.service_interval_km) });
                toast.success('Vehicle updated.');
            } else {
                await api.post('/vehicles', {
                    plate_number: form.plate_number, model: form.model,
                    initial_odometer: form.initial_odometer === '' ? 0 : Number(form.initial_odometer),
                    service_interval_km: Number(form.service_interval_km),
                });
                toast.success('Vehicle registered.');
            }
            setForm(null);
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const toggleMaintenance = async (v) => {
        const next = v.status === 'Maintenance' ? 'Available' : 'Maintenance';
        try {
            await api.put(`/vehicles/${v.vehicle_id}/status`, { status: next });
            toast.success(next === 'Maintenance' ? `${v.plate_number} placed in maintenance.` : `${v.plate_number} returned to service.`);
            await load();
        } catch (error) { toast.error(errorMessage(error)); }
    };

    const deactivate = async (v) => {
        if (!window.confirm(`Deactivate ${v.plate_number}? It will no longer appear in the fleet, but its history is kept.`)) return;
        try {
            await api.delete(`/vehicles/${v.vehicle_id}`);
            toast.success('Vehicle deactivated.');
            await load();
        } catch (error) { toast.error(errorMessage(error)); }
    };

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <>
            <PageHeader title="Vehicles" subtitle={`${vehicles.length} active vehicles`}>
                <input className="search" type="search" placeholder="Search plate or model" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Add vehicle</button>
            </PageHeader>

            {loading ? <Spinner label="Loading vehicles..." /> : (
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr><th>Plate</th><th>Model</th><th>Status</th><th className="num">Odometer</th><th className="num">Next service</th><th>Maintenance</th><th /></tr>
                        </thead>
                        <tbody>
                            {shown.length === 0 && <tr><td colSpan="7" className="empty">No vehicles found.</td></tr>}
                            {shown.map((v) => (
                                <tr key={v.vehicle_id}>
                                    <td><strong>{v.plate_number}</strong></td>
                                    <td>{v.model}</td>
                                    <td><StatusBadge value={v.status} /></td>
                                    <td className="num">{fmtKm(v.current_odometer)}</td>
                                    <td className="num">{fmtKm(v.next_service_due)}<div className="muted small">every {Number(v.service_interval_km).toLocaleString()} km</div></td>
                                    <td>{v.active_alert ? <StatusBadge value={v.active_alert} /> : <span className="muted small">OK</span>}</td>
                                    <td className="row-actions">
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...v, initial_odometer: v.initial_odometer })}>Edit</button>
                                        <button type="button" className="btn btn-ghost btn-sm" disabled={v.status === 'In Trip'} onClick={() => toggleMaintenance(v)}>{v.status === 'Maintenance' ? 'Return to service' : 'Set maintenance'}</button>
                                        <button type="button" className="btn btn-danger-ghost btn-sm" disabled={v.status === 'In Trip'} onClick={() => deactivate(v)}>Deactivate</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {form && (
                <Modal title={form.vehicle_id ? 'Edit vehicle' : 'Add vehicle'} onClose={() => setForm(null)}>
                    <form onSubmit={save} className="form">
                        <label className="field"><span>Plate number</span><input value={form.plate_number} onChange={set('plate_number')} required maxLength={20} /></label>
                        <label className="field"><span>Model</span><input value={form.model} onChange={set('model')} required maxLength={100} /></label>
                        {!form.vehicle_id && (
                            <label className="field"><span>Current odometer (km)</span><input type="number" min="0" step="0.1" value={form.initial_odometer} onChange={set('initial_odometer')} placeholder="0" /></label>
                        )}
                        <label className="field"><span>Service interval (km)</span><input type="number" min="1" step="1" value={form.service_interval_km} onChange={set('service_interval_km')} required /></label>
                        <div className="form-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}
