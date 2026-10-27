import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/axios';
import Spinner from '../components/Spinner';

export default function Login() {
    const { user, loading, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    if (loading) return <Spinner full label="Loading..." />;
    if (user) return <Navigate to={homePathFor(user)} replace />;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const u = await login(email.trim(), password);
            navigate(homePathFor(u), { replace: true });
        } catch (err) {
            setError(errorMessage(err, 'Login failed. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login-page">
            <section className="login-hero">
                <img src="/abu-logo-white.png" alt="Ahmadu Bello University logo" />
                <h1>University Fleet Management System</h1>
                <p>Real-time vehicle tracking, trip dispatch and predictive maintenance for the Ahmadu Bello University motor pool.</p>
                <small>Ahmadu Bello University, Zaria</small>
            </section>
            <section className="login-panel">
                <form className="login-card" onSubmit={handleSubmit}>
                    <img className="login-mobile-logo" src="/abu-logo.png" alt="" />
                    <h2>Sign in</h2>
                    <p className="muted">Use the account issued by the transport office.</p>
                    {error && <div className="alert alert-error" role="alert">{error}</div>}
                    <label className="field">
                        <span>Email address</span>
                        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <div className="input-row">
                            <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((s) => !s)}>{showPassword ? 'Hide' : 'Show'}</button>
                        </div>
                    </label>
                    <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
                </form>
            </section>
        </div>
    );
}
