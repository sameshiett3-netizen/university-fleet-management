import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, homePathFor, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Maintenance from './pages/Maintenance';
import DriverPortal from './pages/DriverPortal';

// The map (Leaflet) is the heaviest part of the app, so it is loaded only when opened
const LiveTracking = lazy(() => import('./pages/LiveTracking'));

function Home() {
    const { user, loading } = useAuth();
    if (loading) return <Spinner full label="Loading..." />;
    return <Navigate to={user ? homePathFor(user) : '/login'} replace />;
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AuthProvider>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute role="Admin" />}>
                            <Route path="/admin" element={<Layout variant="admin" />}>
                                <Route index element={<Dashboard />} />
                                <Route path="tracking" element={<Suspense fallback={<Spinner label="Loading map..." />}><LiveTracking /></Suspense>} />
                                <Route path="trips" element={<Trips />} />
                                <Route path="vehicles" element={<Vehicles />} />
                                <Route path="drivers" element={<Drivers />} />
                                <Route path="maintenance" element={<Maintenance />} />
                            </Route>
                        </Route>

                        <Route element={<ProtectedRoute role="Driver" />}>
                            <Route path="/driver" element={<Layout variant="driver" />}>
                                <Route index element={<DriverPortal />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Home />} />
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}
