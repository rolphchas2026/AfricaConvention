const express = require('express');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  database: process.env.DB_NAME || 'africa_convention'
});

// Initialize database
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        category VARCHAR(100),
        checked_in BOOLEAN DEFAULT false,
        checked_in_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ Database error:', err);
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Get all attendees
app.get('/api/attendees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attendees ORDER BY created_at DESC');
    res.json({ attendees: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create attendee
app.post('/api/attendees', async (req, res) => {
  const { name, email, phone, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO attendees (name, email, phone, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone, category]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify QR / Check-in
app.post('/api/verify-qr', async (req, res) => {
  const { attendee_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [attendee_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json({ success: true, message: 'Check-in successful', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_registered,
        COUNT(CASE WHEN checked_in = true THEN 1 END) as total_checked_in,
        ROUND(100.0 * COUNT(CASE WHEN checked_in = true THEN 1 END) / COUNT(*), 2) as check_in_rate
      FROM attendees
    `);
    
    const byCategory = await pool.query(`
      SELECT category, COUNT(*) as registered, COUNT(CASE WHEN checked_in = true THEN 1 END) as checked_in
      FROM attendees
      GROUP BY category
    `);

    res.json({
      summary: result.rows[0],
      by_category: byCategory.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve simple dashboard HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Africa Convention - Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 14px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .card h2 { color: #667eea; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; }
        .card .number { font-size: 32px; font-weight: bold; color: #333; }
        .section { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .section h2 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        button { background: #667eea; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
        button:hover { background: #764ba2; }
        input, select { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #333; font-weight: bold; }
        .success { color: green; padding: 10px; background: #e8f5e9; border-radius: 5px; margin-bottom: 10px; }
        .error { color: red; padding: 10px; background: #ffebee; border-radius: 5px; margin-bottom: 10px; }
        .attendee { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
        .attendee-name { font-weight: bold; color: #333; }
        .attendee-status { font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>🎫 2026 Africa Convention - Dashboard</h1>
          <p class="subtitle">Live Event Management System</p>
        </header>

        <div class="grid" id="stats">
          <div class="card">
            <h2>Total Registered</h2>
            <div class="number" id="total">0</div>
          </div>
          <div class="card">
            <h2>Checked In</h2>
            <div class="number" id="checked">0</div>
          </div>
          <div class="card">
            <h2>Check-in Rate</h2>
            <div class="number" id="rate">0%</div>
          </div>
        </div>

        <div class="section">
          <h2>➕ Add New Attendee</h2>
          <div id="message"></div>
          <form onsubmit="addAttendee(event)">
            <div class="form-group">
              <label>Name:</label>
              <input type="text" id="name" required>
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input type="email" id="email" required>
            </div>
            <div class="form-group">
              <label>Phone:</label>
              <input type="tel" id="phone">
            </div>
            <div class="form-group">
              <label>Category:</label>
              <select id="category">
                <option>Youth</option>
                <option>Speaker</option>
                <option>Business</option>
                <option>Leader</option>
              </select>
            </div>
            <button type="submit">Add Attendee</button>
          </form>
        </div>

        <div class="section">
          <h2>🔍 Check-in by ID</h2>
          <div class="form-group">
            <label>Attendee ID:</label>
            <input type="number" id="checkinId" placeholder="Enter attendee ID">
          </div>
          <button onclick="checkIn()">Check In</button>
        </div>

        <div class="section">
          <h2>👥 Attendees</h2>
          <div id="attendees"></div>
        </div>
      </div>

      <script>
        // Load statistics
        async function loadStats() {
          try {
            const res = await fetch('/api/statistics');
            const data = await res.json();
            document.getElementById('total').textContent = data.summary.total_registered || 0;
            document.getElementById('checked').textContent = data.summary.total_checked_in || 0;
            document.getElementById('rate').textContent = (data.summary.check_in_rate || 0) + '%';
          } catch (err) {
            console.error('Error loading stats:', err);
          }
        }

        // Load attendees
        async function loadAttendees() {
          try {
            const res = await fetch('/api/attendees');
            const data = await res.json();
            const html = data.attendees.map(a => \`
              <div class="attendee">
                <div class="attendee-name">\${a.name}</div>
                <div class="attendee-status">
                  \${a.email} | \${a.category} | 
                  \${a.checked_in ? '✅ Checked In' : '⏳ Waiting'}
                </div>
              </div>
            \`).join('');
            document.getElementById('attendees').innerHTML = html || '<p>No attendees yet</p>';
          } catch (err) {
            console.error('Error loading attendees:', err);
          }
        }

        // Add attendee
        async function addAttendee(e) {
          e.preventDefault();
          const name = document.getElementById('name').value;
          const email = document.getElementById('email').value;
          const phone = document.getElementById('phone').value;
          const category = document.getElementById('category').value;

          try {
            const res = await fetch('/api/attendees', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, phone, category })
            });
            const data = await res.json();
            document.getElementById('message').innerHTML = '<div class="success">✅ Attendee added successfully!</div>';
            document.querySelector('form').reset();
            loadStats();
            loadAttendees();
          } catch (err) {
            document.getElementById('message').innerHTML = '<div class="error">❌ Error adding attendee</div>';
          }
        }

        // Check in
        async function checkIn() {
          const id = document.getElementById('checkinId').value;
          if (!id) return alert('Please enter attendee ID');

          try {
            const res = await fetch('/api/verify-qr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attendee_id: id })
            });
            const data = await res.json();
            if (data.success) {
              alert('✅ Check-in successful!');
              document.getElementById('checkinId').value = '';
              loadStats();
              loadAttendees();
            } else {
              alert('❌ ' + (data.error || 'Check-in failed'));
            }
          } catch (err) {
            alert('❌ Error: ' + err.message);
          }
        }

        // Load on startup
        window.addEventListener('load', () => {
          loadStats();
          loadAttendees();
          setInterval(() => {
            loadStats();
            loadAttendees();
          }, 5000); // Refresh every 5 seconds
        });
      </script>
    </body>
    </html>
  `);
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`✅ Server running on port \${PORT}\`);
    console.log(\`📊 Dashboard: http://localhost:\${PORT}\`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize:', err);
  process.exit(1);
});

module.exports = app;
