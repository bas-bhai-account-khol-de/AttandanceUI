const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'attendance.db');
const db = new Database(dbPath);

// Create punch_records table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS punch_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    punch_in_time TEXT NOT NULL,
    punch_out_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add punch_out_time column if migrating from old schema
try {
  db.exec(`ALTER TABLE punch_records ADD COLUMN punch_out_time TEXT`);
} catch (e) {
  // Column already exists
}

// POST /api/punch - Receive punch in time and employee id
app.post('/api/punch', (req, res) => {
  try {
    const { employeeId, punchInTime } = req.body;

    if (!employeeId || !punchInTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId and punchInTime are required',
      });
    }

    const insert = db.prepare(`
      INSERT INTO punch_records (employee_id, punch_in_time)
      VALUES (?, ?)
    `);

    const result = insert.run(String(employeeId), String(punchInTime));

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      employeeId,
      punchInTime,
      message: 'Punch record saved successfully',
    });
  } catch (err) {
    console.error('Error saving punch record:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to save punch record',
    });
  }
});

// POST /api/punch-out - Record punch out for employee's most recent open shift
app.post('/api/punch-out', (req, res) => {
  try {
    const { employeeId, punchOutTime } = req.body;

    if (!employeeId || !punchOutTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId and punchOutTime are required',
      });
    }

    const latest = db.prepare(`
      SELECT id FROM punch_records
      WHERE employee_id = ? AND punch_out_time IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(String(employeeId));

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: 'No open punch-in found for this employee. Punch in first.',
      });
    }

    const update = db.prepare(`
      UPDATE punch_records SET punch_out_time = ? WHERE id = ?
    `);
    update.run(String(punchOutTime), latest.id);

    res.json({
      success: true,
      id: latest.id,
      employeeId,
      punchOutTime,
      message: 'Punch out recorded successfully',
    });
  } catch (err) {
    console.error('Error saving punch out:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to save punch out',
    });
  }
});

// GET /api/punches - Retrieve all punch records
app.get('/api/punches', (req, res) => {
  try {
    const punches = db.prepare(`
      SELECT id, employee_id as employeeId, punch_in_time as punchInTime,
             punch_out_time as punchOutTime, created_at as createdAt
      FROM punch_records
      ORDER BY created_at DESC
    `).all();

    res.json({ success: true, data: punches });
  } catch (err) {
    console.error('Error fetching punch records:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch records' });
  }
});

app.listen(PORT, () => {
  console.log(`Attendance API running at http://localhost:${PORT}`);
  console.log(`UI: http://localhost:${PORT}`);
  console.log('POST /api/punch     - Punch in  (JSON: { employeeId, punchInTime })');
  console.log('POST /api/punch-out - Punch out (JSON: { employeeId, punchOutTime })');
  console.log('GET  /api/punches   - List all punch records');
});
