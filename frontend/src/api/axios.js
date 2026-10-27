import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // send the HttpOnly session cookie
    headers: { 'X-Requested-With': 'XMLHttpRequest' }, // required by the API for state-changing requests
});

// Human-readable message from a failed request
export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
    error?.response?.data?.error || (error?.request ? 'Cannot reach the server. Check your connection.' : fallback);

export default api;
