const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, db } = require('./helpers');
const { classify, evaluateMaintenance } = require('../utils/maintenanceEngine');
const { withTransaction } = require('../utils/tx');

// Worked example from the report: interval 5,000 km, baseline 40,000 km -> service point 45,000, warning at 44,500
test('classify: below the warning threshold gives no alert', () => {
    assert.equal(classify(44200, 40000, 5000).level, null);
});
test('classify: at the warning threshold gives Warning', () => {
    assert.equal(classify(44500, 40000, 5000).level, 'Warning');
    assert.equal(classify(44600, 40000, 5000).level, 'Warning');
});
test('classify: at or past the service point gives Overdue', () => {
    assert.equal(classify(45000, 40000, 5000).level, 'Overdue');
    assert.equal(classify(45100, 40000, 5000).level, 'Overdue');
});
test('classify: next service due is baseline + interval', () => {
    assert.equal(classify(0, 40000, 5000).nextServiceDue, 45000);
});

test('evaluateMaintenance: creates, escalates, never duplicates, and resolves alerts', async () => {
    await resetDatabase();
    const [v] = await db.query("INSERT INTO vehicles (plate_number, model, initial_odometer, current_odometer, service_interval_km) VALUES ('T-1','Test',40000,40000,5000)");
    const id = v.insertId;
    const run = () => withTransaction((conn) => evaluateMaintenance(id, conn));
    const active = async () => (await db.query("SELECT alert_level FROM maintenance_alerts WHERE vehicle_id = ? AND status = 'Active'", [id]))[0];

    await run();
    assert.equal((await active()).length, 0);

    await db.query('UPDATE vehicles SET current_odometer = 44600 WHERE vehicle_id = ?', [id]);
    await run(); await run(); // running twice must not duplicate
    let a = await active();
    assert.equal(a.length, 1); assert.equal(a[0].alert_level, 'Warning');

    await db.query('UPDATE vehicles SET current_odometer = 45100 WHERE vehicle_id = ?', [id]);
    await run();
    a = await active();
    assert.equal(a.length, 1); assert.equal(a[0].alert_level, 'Overdue'); // escalated, not duplicated

    // A service record moves the baseline forward; the alert clears
    await db.query("INSERT INTO maintenance_records (vehicle_id, service_date, odometer_at_service) VALUES (?, CURDATE(), 45100)", [id]);
    const result = await run();
    assert.equal((await active()).length, 0);
    assert.equal(result.baseline, 45100);
    assert.equal(result.nextServiceDue, 50100);
});

test.after(async () => { await db.end(); });
