// Sends an event to every connected administrator dashboard (no-op when Socket.io is not running, e.g. in tests).
function emitToAdmins(req, event, payload) {
    const io = req.app.get('io');
    if (io) io.to('admins').emit(event, payload);
}
module.exports = { emitToAdmins };
