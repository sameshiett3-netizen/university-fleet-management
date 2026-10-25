import { useEffect, useState } from 'react';

export default function MaintenanceAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch live maintenance alerts from the backend API
    useEffect(() => {
        fetch('http://localhost:5000/api/maintenance')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setAlerts(data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching maintenance alerts:", err);
                setLoading(false);
            });
    }, []);

    // Function to mark an alert as resolved
    const markAsResolved = async (alertId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/maintenance/${alertId}/resolve`, {
                method: 'PUT'
            });
            if (res.ok) {
                // Remove resolved alert from local state instantly
                setAlerts(prev => prev.filter(alert => alert.alert_id !== alertId));
            }
        } catch (err) {
            console.error("Failed to resolve maintenance alert:", err);
        }
    };

    if (loading) {
        return <div style={{ padding: '20px', background: '#fff3cd', borderRadius: '8px' }}>Loading maintenance alerts...</div>;
    }

    return (
        <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', borderLeft: '5px solid #ffc107', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#856404' }}>⚠️ Predictive & Preventive Maintenance Alerts</h3>
            {alerts.length === 0 ? (
                <p style={{ color: '#856404', margin: 0 }}>All fleet vehicles are operating within safe mileage thresholds.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ background: '#ffeeba', textAlign: 'left', color: '#856404' }}>
                            <th style={{ padding: '8px' }}>Vehicle ID</th>
                            <th style={{ padding: '8px' }}>Trigger Mileage</th>
                            <th style={{ padding: '8px' }}>Description</th>
                            <th style={{ padding: '8px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {alerts.map(alert => (
                            <tr key={alert.alert_id} style={{ borderBottom: '1px solid #ffe8a1', color: '#856404' }}>
                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{alert.vehicle_id}</td>
                                <td style={{ padding: '8px' }}>{Number(alert.trigger_mileage).toFixed(1)} km</td>
                                <td style={{ padding: '8px' }}>{alert.issue_description}</td>
                                <td style={{ padding: '8px' }}>
                                    <button 
                                        onClick={() => markAsResolved(alert.alert_id)}
                                        style={{ 
                                            background: '#28a745', 
                                            color: '#fff', 
                                            border: 'none', 
                                            padding: '5px 10px', 
                                            borderRadius: '4px', 
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Mark Serviced
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}