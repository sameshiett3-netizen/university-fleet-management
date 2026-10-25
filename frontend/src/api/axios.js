import axios from 'axios';

export default axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true // Crucial: This forces the browser to send your JWT cookie
});