import { Navigate, Outlet } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

// Renders its children only for a signed-in user with the required role
export default function ProtectedRoute({ role }) {
    const { user, loading } = useAuth();
    if (loading) return <Spinner full label="Checking your session..." />;
    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) return <Navigate to={homePathFor(user)} replace />;
    return <Outlet />;
}
