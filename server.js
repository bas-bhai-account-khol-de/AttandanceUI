const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'attendance.db');
const db = new Database(dbPath);

// Create punch_records table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS punch_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    punch_in_time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

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

// GET /api/punches - Optional: retrieve all punch records
app.get('/api/punches', (req, res) => {
  try {
    const punches = db.prepare(`
      SELECT id, employee_id as employeeId, punch_in_time as punchInTime, created_at as createdAt
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
  console.log('POST /api/punch - Submit punch in (JSON: { employeeId, punchInTime })');
  console.log('GET  /api/punches - List all punch records');
});
