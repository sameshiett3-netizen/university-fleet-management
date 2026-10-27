import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/format';

const EMPTY = { name: '', email: '', password: '' };

export default function Drivers() {
    const toast = useToast();
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setDrivers((await api.get('/drivers')).data);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load drivers.'));
        } finally {
            setLoading(false);
        }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (form.user_id) {
                const body = { name: form.name, email: form.email };
                if (form.password) body.password = form.password;
                await api.put(`/drivers/${form.user_id}`, body);
                toast.success('Driver updated.');
            } else {
                await api.post('/drivers', { name: form.name, email: form.email, password: form.password });
                toast.success('Driver account created.');
            }
            setForm(null);
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const deactivate = async (d) => {
        if (!window.confirm(`Deactivate ${d.name}? They will no longer be able to sign in.`)) return;
        try {
            await api.delete(`/drivers/${d.user_id}`);
            toast.success('Driver deactivated.');
            await load();
        } catch (error) { toast.error(errorMessage(error)); }
    };

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <>
            <PageHeader title="Drivers" subtitle={`${drivers.length} active drivers`}>
                <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Add driver</button>
            </PageHeader>

            {loading ? <Spinner label="Loading drivers..." /> : (
                <div className="table-wrap">
                    <table className="table">
                        <thead><tr><th>Name</th><th>Email</th><th>Added</th><th /></tr></thead>
                        <tbody>
                            {drivers.length === 0 && <tr><td colSpan="4" className="empty">No drivers yet.</td></tr>}
                            {drivers.map((d) => (
                                <tr key={d.user_id}>
                                    <td><strong>{d.name}</strong></td>
                                    <td>{d.email}</td>
                                    <td>{fmtDate(d.created_at)}</td>
                                    <td className="row-actions">
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...d, password: '' })}>Edit</button>
                                        <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => deactivate(d)}>Deactivate</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {form && (
                <Modal title={form.user_id ? 'Edit driver' : 'Add driver'} onClose={() => setForm(null)}>
                    <form onSubmit={save} className="form">
                        <label className="field"><span>Full name</span><input value={form.name} onChange={set('name')} required maxLength={100} /></label>
                        <label className="field"><span>Email address</span><input type="email" value={form.email} onChange={set('email')} required maxLength={100} /></label>
                        <label className="field">
                            <span>{form.user_id ? 'New password (leave blank to keep)' : 'Password'}</span>
                            <input type="password" value={form.password} onChange={set('password')} minLength={8} maxLength={72} required={!form.user_id} autoComplete="new-password" />
                            <small className="muted">At least 8 characters.</small>
                        </label>
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
