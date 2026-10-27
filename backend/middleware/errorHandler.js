const { HttpError } = require('../utils/errors');

function notFound(req, res) {
    res.status(404).json({ error: 'Route not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with these details already exists.' });
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
}

module.exports = { notFound, errorHandler };
