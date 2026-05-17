// qr-server-integrated.js - QR API with ALFIO Integration
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Connection (Shared Database with ALFIO)
const pool = new Pool({
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'africa_convention',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize Database Tables
async function initializeDatabase() {
  try {
    // Attendees table (shared with ALFIO)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendees (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(50),
        ticket_id VARCHAR(255) UNIQUE,
        qr_code VARCHAR(500) UNIQUE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        category VARCHAR(100),
        registration_source VARCHAR(50) DEFAULT 'alfio',
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checked_in BOOLEAN DEFAULT false,
        checked_in_at TIMESTAMP,
        checked_in_by VARCHAR(255),
        verified BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_qr_code ON attendees(qr_code);
      CREATE INDEX IF NOT EXISTS idx_ticket_id ON attendees(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_email ON attendees(email);
      CREATE INDEX IF NOT EXISTS idx_checked_in ON attendees(checked_in);
      CREATE INDEX IF NOT EXISTS idx_event ON attendees(event_id);
    `);

    // Check-in log (audit trail)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_log (
        id SERIAL PRIMARY KEY,
        attendee_id INT REFERENCES attendees(id),
        qr_code VARCHAR(500),
        check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        check_in_location VARCHAR(255),
        device_id VARCHAR(255),
        ip_address INET,
        status VARCHAR(50) DEFAULT 'success',
        notes TEXT,
        staff_name VARCHAR(255)
      );
      
      CREATE INDEX IF NOT EXISTS idx_attendee_log ON checkin_log(attendee_id);
      CREATE INDEX IF NOT EXISTS idx_log_time ON checkin_log(check_in_time DESC);
    `);

    // Real-time statistics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_statistics (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(50),
        date DATE DEFAULT CURRENT_DATE,
        total_registered INT DEFAULT 0,
        total_checked_in INT DEFAULT 0,
        total_verified INT DEFAULT 0,
        check_in_rate DECIMAL(5,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase();

// ==================== ROUTES ====================

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      integration: 'alfio-qr',
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ==================== QR VERIFICATION ====================

// POST: Scan & Verify QR Code (Main Check-in Endpoint)
app.post('/api/verify-qr', async (req, res) => {
  const { qr_code, staff_name, location } = req.body;

  if (!qr_code) {
    return res.status(400).json({ error: 'QR code required' });
  }

  try {
    // Find attendee by QR code
    const attendeeResult = await pool.query(
      `SELECT * FROM attendees WHERE qr_code = $1`,
      [qr_code]
    );

    if (attendeeResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Invalid QR code - attendee not found',
        verified: false 
      });
    }

    const attendee = attendeeResult.rows[0];

    // Check if already checked in
    if (attendee.checked_in) {
      return res.status(409).json({ 
        error: 'Attendee already checked in',
        attendee_name: attendee.name,
        checked_in_at: attendee.checked_in_at,
        verified: false
      });
    }

    // Mark as checked in
    const updateResult = await pool.query(
      `UPDATE attendees 
       SET checked_in = true, 
           checked_in_at = CURRENT_TIMESTAMP,
           checked_in_by = $1,
           verified = true
       WHERE id = $2 
       RETURNING *`,
      [staff_name || 'system', attendee.id]
    );

    // Log the check-in
    await pool.query(
      `INSERT INTO checkin_log (attendee_id, qr_code, check_in_location, device_id, ip_address, staff_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        attendee.id,
        qr_code,
        location || 'main-entrance',
        req.headers['user-agent']?.substring(0, 100) || 'unknown',
        req.ip,
        staff_name || 'system',
        'success'
      ]
    );

    // Update statistics
    await updateStatistics(attendee.event_id);

    res.status(200).json({
      success: true,
      message: `✓ ${attendee.name} checked in successfully`,
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error('QR verification error:', error);
    res.status(500).json({ error: 'Failed to verify QR code' });
  }
});

// POST: Manual Check-in (Supervisor override)
app.post('/api/checkin-manual', async (req, res) => {
  const { email, staff_name, location, reason } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const attendeeResult = await pool.query(
      `SELECT * FROM attendees WHERE email = $1`,
      [email]
    );

    if (attendeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    const attendee = attendeeResult.rows[0];

    if (attendee.checked_in) {
      return res.status(409).json({ 
        error: 'Already checked in',
        attendee_name: attendee.name 
      });
    }

    const updateResult = await pool.query(
      `UPDATE attendees 
       SET checked_in = true, 
           checked_in_at = CURRENT_TIMESTAMP,
           checked_in_by = $1
       WHERE id = $2 
       RETURNING *`,
      [staff_name || 'manual-entry', attendee.id]
    );

    await pool.query(
      `INSERT INTO checkin_log (attendee_id, check_in_location, staff_name, status, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        attendee.id,
        location || 'manual',
        staff_name || 'system',
        'success',
        `Manual check-in: ${reason || 'no reason provided'}`
      ]
    );

    res.status(200).json({
      success: true,
      message: `${attendee.name} checked in (manual)`,
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Manual check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// ==================== ATTENDEE MANAGEMENT ====================

// GET: List all attendees (with check-in status)
app.get('/api/attendees', async (req, res) => {
  const { category, checked_in, limit = 100, offset = 0 } = req.query;

  try {
    let query = 'SELECT * FROM attendees WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (checked_in === 'true') {
      query += ` AND checked_in = true`;
    } else if (checked_in === 'false') {
      query += ` AND checked_in = false`;
    }

    paramCount++;
    query += ` ORDER BY registered_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM attendees');

    res.json({
      attendees: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list attendees' });
  }
});

// ==================== STATISTICS ====================

// GET: Real-time dashboard statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_registered,
        COUNT(CASE WHEN checked_in = true THEN 1 END) as total_checked_in,
        COUNT(CASE WHEN verified = true THEN 1 END) as total_verified,
        ROUND(
          (COUNT(CASE WHEN checked_in = true THEN 1 END)::FLOAT / COUNT(*) * 100)::NUMERIC, 
          2
        ) as check_in_rate
      FROM attendees
    `);

    const byCategory = await pool.query(`
      SELECT category, 
             COUNT(*) as registered,
             COUNT(CASE WHEN checked_in = true THEN 1 END) as checked_in
      FROM attendees
      GROUP BY category
      ORDER BY registered DESC
    `);

    const recentCheckins = await pool.query(`
      SELECT a.name, a.category, c.check_in_time, c.staff_name
      FROM attendees a
      JOIN checkin_log c ON a.id = c.attendee_id
      ORDER BY c.check_in_time DESC
      LIMIT 10
    `);

    res.json({
      summary: stats.rows[0],
      by_category: byCategory.rows,
      recent_checkins: recentCheckins.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET: Live dashboard data (for supervisor)
app.get('/api/dashboard', async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN checked_in = true THEN 1 END) as checked_in,
        COUNT(CASE WHEN checked_in = false THEN 1 END) as pending
      FROM attendees
    `);

    const timeline = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', c.check_in_time) as hour,
        COUNT(*) as count
      FROM checkin_log c
      GROUP BY DATE_TRUNC('hour', c.check_in_time)
      ORDER BY hour DESC
      LIMIT 24
    `);

    res.json({
      status: 'live',
      summary: summary.rows[0],
      timeline: timeline.rows,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ==================== EXPORTS ====================

// GET: Export check-in data
app.get('/api/export/checkins', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.name, a.email, a.phone, a.category, 
             a.checked_in, a.checked_in_at, a.checked_in_by,
             COUNT(c.id) as total_scans
      FROM attendees a
      LEFT JOIN checkin_log c ON a.id = c.attendee_id
      GROUP BY a.id, a.name, a.email, a.phone, a.category, 
               a.checked_in, a.checked_in_at, a.checked_in_by
      ORDER BY a.checked_in_at DESC
    `);

    let csv = 'Name,Email,Phone,Category,Checked In,Check-in Time,Checked In By,Scans\n';
    result.rows.forEach(row => {
      csv += `"${row.name}","${row.email}","${row.phone || ''}","${row.category}",${row.checked_in},"${row.checked_in_at || ''}","${row.checked_in_by || ''}",${row.total_scans}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="checkins.csv"');
    res.send(csv);

  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ==================== UTILITIES ====================

async function updateStatistics(eventId) {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_registered,
        COUNT(CASE WHEN checked_in = true THEN 1 END) as total_checked_in,
        COUNT(CASE WHEN verified = true THEN 1 END) as total_verified
      FROM attendees
      WHERE event_id = $1
    `, [eventId || '2026-africa']);

    const row = stats.rows[0];
    const checkInRate = row.total_registered > 0 ? 
      ((row.total_checked_in / row.total_registered) * 100).toFixed(2) : 0;

    await pool.query(`
      INSERT INTO event_statistics (event_id, total_registered, total_checked_in, total_verified, check_in_rate)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        total_registered = $2,
        total_checked_in = $3,
        total_verified = $4,
        check_in_rate = $5,
        updated_at = CURRENT_TIMESTAMP
    `, [eventId || '2026-africa', row.total_registered, row.total_checked_in, row.total_verified, checkInRate]);
  } catch (error) {
    console.error('Stats update error:', error);
  }
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Integrated QR Check-in API running on port ${PORT}`);
  console.log(`  • Verification: /api/verify-qr`);
  console.log(`  • Dashboard: /api/dashboard`);
  console.log(`  • Statistics: /api/statistics`);
});

module.exports = app;
