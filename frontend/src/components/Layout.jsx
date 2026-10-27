import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from './Icons';

const ADMIN_NAV = [
    { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/admin/tracking', label: 'Live Tracking', icon: 'map' },
    { to: '/admin/trips', label: 'Trips', icon: 'trip' },
    { to: '/admin/vehicles', label: 'Vehicles', icon: 'vehicle' },
    { to: '/admin/drivers', label: 'Drivers', icon: 'users' },
    { to: '/admin/maintenance', label: 'Maintenance', icon: 'wrench' },
];

export default function Layout({ variant }) {
    const { user, logout } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const isAdmin = variant === 'admin';

    const handleLogout = async () => {
        try { await logout(); } catch { toast.error('Could not log out cleanly.'); }
        navigate('/login', { replace: true });
    };

    const brand = (
        <div className="brand">
            <img src="/abu-logo-white.png" alt="Ahmadu Bello University logo" />
            <div>
                <strong>ABU Fleet</strong>
                <span>Management System</span>
            </div>
        </div>
    );

    return (
        <div className={`shell ${isAdmin ? 'shell-admin' : 'shell-driver'}`}>
            {isAdmin && (
                <aside className={`sidebar ${open ? 'open' : ''}`}>
                    {brand}
                    <nav>
                        {ADMIN_NAV.map((n) => (
                            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                <Icon name={n.icon} />
                                <span>{n.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                    <div className="sidebar-foot">Ahmadu Bello University, Zaria</div>
                </aside>
            )}
            {isAdmin && open && <div className="scrim" onClick={() => setOpen(false)} />}

            <div className="main">
                <header className="topbar">
                    {isAdmin ? (
                        <button type="button" className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation">
                            <Icon name="menu" />
                        </button>
                    ) : (
                        <div className="brand brand-top">{brand.props.children}</div>
                    )}
                    <div className="topbar-right">
                        <div className="whoami">
                            <strong>{user?.name}</strong>
                            <span>{user?.role}</span>
                        </div>
                        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                            <Icon name="logout" size={18} /> <span className="hide-sm">Log out</span>
                        </button>
                    </div>
                </header>
                <main className="content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
