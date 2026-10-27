import { io } from 'socket.io-client';
import { API_URL } from './axios';

// The socket server lives on the same origin as the REST API (without the /api path)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || new URL(API_URL, window.location.href).origin;

// Sends the session cookie with the handshake; the server only accepts administrators.
export const createSocket = () => io(SOCKET_URL, { withCredentials: true });
