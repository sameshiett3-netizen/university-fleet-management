import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
    // I've pre-filled your admin credentials so you don't have to type them every time during development
    const [email, setEmail] = useState('admin@abu.edu.ng'); 
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/admin'); // Redirect to dashboard on success
        } catch (err) {
            setError('Invalid email or password');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>University Fleet Management</h1>
            <div style={{ padding: '30px', border: '1px solid #ccc', borderRadius: '8px', width: '350px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Admin Login</h2>
                {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{error}</p>}
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="Email" 
                        required 
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #aaa' }} 
                    />
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Password" 
                        required 
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #aaa' }} 
                    />
                    <button 
                        type="submit" 
                        style={{ padding: '12px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}