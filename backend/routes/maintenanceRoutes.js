const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/maintenance - Fetch all pending maintenance alerts
router.get('/', async (req, res) => {
    try {
        const [alerts] = await db.execute('SELECT * FROM maintenance_alerts WHERE status = "Pending" ORDER BY created_at DESC');
        res.json(alerts);
    } catch (error) {
        console.error("Error fetching maintenance alerts:", error.message);
        res.status(500).json({ error: 'Failed to fetch maintenance alerts' });
    }
});

// PUT /api/maintenance/:alert_id/resolve - Mark an alert as completed/serviced
router.put('/:alert_id/resolve', async (req, res) => {
    const { alert_id } = req.params;
    try {
        await db.execute('UPDATE maintenance_alerts SET status = "Completed" WHERE alert_id = ?', [alert_id]);
        res.json({ success: true, message: 'Maintenance alert marked as resolved.' });
    } catch (error) {
        console.error("Error resolving maintenance alert:", error.message);
        res.status(500).json({ error: 'Failed to resolve maintenance alert' });
    }
});

module.exports = router;