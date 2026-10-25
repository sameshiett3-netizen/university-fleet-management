import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import VehicleManager from '../components/VehicleManager';
import LiveMap from '../components/LiveMap';
import TripDispatch from '../components/TripDispatch';
import MaintenanceAlerts from '../components/MaintenanceAlerts';

export default function AdminDashboard() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/'); 
    };

    return (
        <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Fleet Command Center</h1>
                    <p style={{ color: '#666', marginTop: '5px' }}>Logged in as: {user?.name || 'System Admin'}</p>
                </div>
                <button 
                    onClick={handleLogout} 
                    style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Logout
                </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <h2 style={{ marginBottom: '15px', color: '#333' }}>Active Fleet Map</h2>
                        <LiveMap />
                    </div>
                    <MaintenanceAlerts />
                </section>
                
                <section>
                    <h2 style={{ marginBottom: '15px', color: '#333' }}>Vehicle Inventory</h2>
                    <TripDispatch />
                    <VehicleManager />
                </section>
            </div>
        </div>
    );
}