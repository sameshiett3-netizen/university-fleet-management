import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function VehicleManager() {
    const [vehicles, setVehicles] = useState([]);
    const [plate, setPlate] = useState('');
    const [model, setModel] = useState('');
    const [odometer, setOdometer] = useState('');

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(res.data);
        } catch (error) {
            console.error('Failed to fetch vehicles', error);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        try {
            await api.post('/vehicles', {
                plate_number: plate,
                model: model,
                initial_odometer: Number(odometer),
                service_interval_km: 5000
            });
            setPlate(''); setModel(''); setOdometer('');
            fetchVehicles(); // Refresh the table instantly
        } catch (error) {
            alert(error.response?.data?.error || 'Error adding vehicle');
        }
    };

    return (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <form onSubmit={handleAddVehicle} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input type="text" placeholder="Plate No." value={plate} onChange={e => setPlate(e.target.value)} required style={{ padding: '8px', border: '1px solid #ccc', flex: 1 }} />
                <input type="text" placeholder="Model" value={model} onChange={e => setModel(e.target.value)} required style={{ padding: '8px', border: '1px solid #ccc', flex: 1 }} />
                <input type="number" placeholder="Odometer" value={odometer} onChange={e => setOdometer(e.target.value)} required style={{ padding: '8px', border: '1px solid #ccc', width: '100px' }} />
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Add</button>
            </form>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                            <th style={{ padding: '10px', borderBottom: '2px solid #dee2e6' }}>Plate</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #dee2e6' }}>Model</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #dee2e6' }}>Status</th>
                            <th style={{ padding: '10px', borderBottom: '2px solid #dee2e6' }}>Odometer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vehicles.map(v => (
                            <tr key={v.vehicle_id}>
                                <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>{v.plate_number}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>{v.model}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.85em', backgroundColor: v.status === 'Available' ? '#d4edda' : '#fff3cd', color: v.status === 'Available' ? '#155724' : '#856404' }}>
                                        {v.status}
                                    </span>
                                </td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>{v.current_odometer} km</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}