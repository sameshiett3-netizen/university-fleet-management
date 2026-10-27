const { Server } = require('socket.io');
const { config } = require('./config/env');
const { userFromToken } = require('./middleware/authMiddleware');

// Minimal Cookie-header parser (avoids an extra dependency)
function readCookie(header, name) {
    for (const part of String(header || '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0 && part.slice(0, i).trim() === name) {
            try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return null; }
        }
    }
    return null;
}

// Live telemetry goes only to authenticated administrators; the handshake is verified with the session cookie.
function initSocket(server, app) {
    const io = new Server(server, { cors: { origin: config.clientOrigin, credentials: true } });

    io.use(async (socket, next) => {
        try {
            const token = readCookie(socket.handshake.headers.cookie, 'token');
            if (!token) throw new Error('unauthorized');
            const user = await userFromToken(token);
            if (user.role !== 'Admin') throw new Error('forbidden');
            socket.data.user = user;
            next();
        } catch (_) {
            next(new Error('unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        socket.join('admins');
    });

    app.set('io', io);
    return io;
}

module.exports = { initSocket };
