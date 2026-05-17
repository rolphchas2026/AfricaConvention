const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  database: process.env.DB_NAME || 'africa_convention'
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention - Supervisor Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header h1 { margin: 0; font-size: 28px; }
    .tabs { display: flex; background: white; border-bottom: 2px solid #667eea; gap: 0; }
    .tab-btn { padding: 15px 25px; cursor: pointer; background: #f5f5f5; border: none; font-size: 14px; font-weight: 500; color: #333; transition: all 0.3s; flex: 1; text-align: center; }
    .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
    .tab-btn:hover { background: #efefef; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    input, select, textarea { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: 10px; margin-top: 10px; }
    button:hover { background: #764ba2; }
    .success { color: green; padding: 10px; background: #e8f5e9; border-radius: 4px; margin: 10px 0; border-left: 4px solid green; }
    .error { color: red; padding: 10px; background: #ffebee; border-radius: 4px; margin: 10px 0; border-left: 4px solid red; }
    .attendee-row { background: #f9f9f9; padding: 12px; margin: 8px 0; border-left: 4px solid #667eea; border-radius: 4px; }
    .badge { display: inline-block; padding: 4px 8px; background: #667eea; color: white; border-radius: 3px; font-size: 12px; margin-right: 5px; }
    .checkin-badge { background: green; }
    .hidden { display: none !important; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .progress-bar { width: 100%; height: 30px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 10px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    label { display: block; margin-bottom: 5px; color: #333; font-weight: 500; }
  </style>
</head>
<body>
<div class="header">
  <h1>🎊 Africa Convention 2026 - Supervisor Dashboard</h1>
  <p>Real-time Event Management System</p>
</div>

<div class="tabs" id="tabButtons">
  <button class="tab-btn active" onclick="openTab(event, 'dashboard')">📊 Live Dashboard</button>
  <button class="tab-btn" onclick="openTab(event, 'checkin')">✅ Check-in</button>
  <button class="tab-btn" onclick="openTab(event, 'badges')">🎫 Badge Generator</button>
  <button class="tab-btn" onclick="openTab(event, 'statistics')">📈 Statistics</button>
</div>

<div class="container">

<!-- TAB 1: DASHBOARD -->
<div id="dashboard" class="tab-content active">
  <div class="card">
    <h2>Real-time Statistics</h2>
    <div class="stats" id="statsContainer">
      <div class="stat">
        <div class="stat-number" id="totalStat">0</div>
        <div class="stat-label">Total Registered</div>
      </div>
      <div class="stat">
        <div class="stat-number" id="checkedStat">0</div>
        <div class="stat-label">Checked In</div>
      </div>
      <div class="stat">
        <div class="stat-number" id="rateStat">0%</div>
        <div class="stat-label">Check-in Rate</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Real-time Check-ins (Last 10)</h2>
    <div id="recentCheckins">Loading...</div>
  </div>

  <div class="card">
    <h2>Attendees by Category</h2>
    <div id="byCategory">Loading...</div>
  </div>
</div>

<!-- TAB 2: CHECK-IN -->
<div id="checkin" class="tab-content">
  <div class="card">
    <h2>Register New Attendee</h2>
    <div id="addMessage"></div>
    <div class="form-row">
      <div><label>Full Name:</label><input type="text" id="name" placeholder="Full Name"></div>
      <div><label>Email:</label><input type="email" id="email" placeholder="Email"></div>
    </div>
    <div class="form-row">
      <div><label>Phone:</label><input type="text" id="phone" placeholder="Phone"></div>
      <div><label>Category:</label>
        <select id="category">
          <option value="">Select Category</option>
          <option value="Youth">Youth</option>
          <option value="Speaker">Speaker</option>
          <option value="Business">Business Leader</option>
          <option value="Staff">Staff</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div><label>Ticket ID:</label><input type="text" id="ticketId" placeholder="Ticket ID (optional)"></div>
      <div><label>Event ID:</label><input type="text" id="eventId" placeholder="Event ID (optional)"></div>
    </div>
    <button onclick="addAttendee()" style="width: 100%; background: #28a745; padding: 15px; font-size: 16px;">✅ Register Attendee</button>
  </div>

  <div class="card">
    <h2>Scan QR Code / Manual Check-in</h2>
    <label>QR Code or Attendee ID:</label>
    <input type="text" id="scanQR" placeholder="Paste QR code or Ticket ID here" autofocus>
    <label>Your Name (Staff):</label>
    <input type="text" id="staffName" placeholder="Your name">
    <button onclick="processCheckIn()" style="width: 100%; background: #28a745; padding: 15px; font-size: 16px;">✅ Check In</button>
  </div>

  <div class="card">
    <h2>Recent Check-ins</h2>
    <div id="checkinLog">Loading...</div>
  </div>
</div>

<!-- TAB 3: BADGE GENERATOR -->
<div id="badges" class="tab-content">
  <div class="card">
    <h2>🎫 ID Badge Generator</h2>
    <p>Generate professional ID badges for all attendees</p>
    
    <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px;">
      <label><strong>Badge Format:</strong></label><br>
      <input type="radio" name="badgeFormat" value="pdf" checked> 📄 PDF (email to attendees)<br>
      <input type="radio" name="badgeFormat" value="html"> 🖨️ HTML (print on cards)
    </div>

    <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px;">
      <label><strong>Quick Actions:</strong></label><br>
      <button onclick="selectBadges('all')">✓ Select All</button>
      <button onclick="selectBadges('none')">✗ Clear</button>
    </div>

    <div style="margin: 15px 0; padding: 15px; background: #e8f5e9; border-radius: 4px; border-left: 4px solid green;">
      <strong>Selected:</strong> <span id="selectedCount">0</span> | <strong>Total:</strong> <span id="totalCount">0</span>
    </div>

    <div style="margin: 15px 0; max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
      <div id="attendeeCheckboxes">Loading attendees...</div>
    </div>

    <button onclick="generateBadges()" style="width: 100%; background: #28a745; color: white; font-size: 16px; padding: 20px; margin-top: 20px; font-weight: bold;">
      ⬇️ Generate & Download Badges
    </button>
  </div>
</div>

<!-- TAB 4: STATISTICS -->
<div id="statistics" class="tab-content">
  <div class="card">
    <h2>Event Statistics Summary</h2>
    <div id="statsDetail">Loading...</div>
  </div>

  <div class="card">
    <h2>Check-in Progress by Category</h2>
    <div id="categoryStats">Loading...</div>
  </div>

  <div class="card">
    <h2>Detailed Attendance Report</h2>
    <div id="detailedReport">Loading...</div>
  </div>
</div>

</div>

<script>
// ===== TAB SWITCHING (FIXED) =====
function openTab(evt, tabName) {
  // Hide all tabs
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Remove active class from all buttons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  
  // Add active class to clicked button
  evt.currentTarget.classList.add('active');
  
  // Load data
  loadData();
}

// ===== LOAD ALL DATA =====
function loadData() {
  loadStats();
  loadRecentCheckins();
  loadAttendeeList();
  loadCategoryStats();
}

// ===== STATISTICS =====
function loadStats() {
  fetch('/api/stats')
    .then(r => r.json())
    .then(data => {
      document.getElementById('totalStat').textContent = data.total;
      document.getElementById('checkedStat').textContent = data.checked;
      document.getElementById('rateStat').textContent = data.rate + '%';
    })
    .catch(e => console.error('Error:', e));
}

function loadRecentCheckins() {
  fetch('/api/checkins/recent')
    .then(r => r.json())
    .then(data => {
      const checkins = data.checkins || [];
      let html = '';
      if (checkins.length === 0) {
        html = '<p style="color: #999;">No check-ins yet</p>';
      } else {
        checkins.forEach(c => {
          const time = new Date(c.checked_in_at).toLocaleTimeString();
          html += '<div class="attendee-row"><strong>' + c.name + '</strong> <span class="badge checkin-badge">✓ ' + time + '</span> <span style="color: #666; font-size: 12px;">by ' + (c.checked_in_by || 'Auto') + '</span></div>';
        });
      }
      document.getElementById('recentCheckins').innerHTML = html;
    })
    .catch(e => console.error('Error:', e));
}

function loadAttendeeList() {
  fetch('/api/attendees')
    .then(r => r.json())
    .then(data => {
      const attendees = data.attendees || [];
      let html = '';
      attendees.forEach(a => {
        html += '<label style="display: block; padding: 8px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; cursor: pointer;"><input type="checkbox" class="badge-checkbox" data-id="' + a.id + '" value="' + a.id + '"> <strong>' + a.name + '</strong> (' + a.category + ') - ' + (a.checked_in ? '✓ Checked In' : '⏳ Waiting') + '</label>';
      });
      document.getElementById('attendeeCheckboxes').innerHTML = html;
      document.getElementById('totalCount').textContent = attendees.length;
      
      // Add change listeners
      document.querySelectorAll('.badge-checkbox').forEach(cb => {
        cb.addEventListener('change', updateBadgeCount);
      });
      updateBadgeCount();
    })
    .catch(e => console.error('Error:', e));
}

function loadCategoryStats() {
  fetch('/api/stats/by-category')
    .then(r => r.json())
    .then(data => {
      const categories = data.categories || [];
      let html = '';
      categories.forEach(c => {
        const pct = c.total > 0 ? Math.round((c.checked / c.total) * 100) : 0;
        html += '<div style="margin: 20px 0;"><div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>' + c.category + '</strong> <span>' + c.checked + ' / ' + c.total + ' (' + pct + '%)</span></div><div class="progress-bar"><div class="progress-fill" style="width: ' + pct + '%">' + pct + '%</div></div></div>';
      });
      document.getElementById('categoryStats').innerHTML = html;
      document.getElementById('byCategory').innerHTML = html;
      
      // Detailed report
      let detail = '<table style="width: 100%; border-collapse: collapse;"><tr style="background: #f0f0f0;"><th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Category</th><th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Registered</th><th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Checked In</th><th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Rate</th></tr>';
      categories.forEach(c => {
        const pct = c.total > 0 ? Math.round((c.checked / c.total) * 100) : 0;
        detail += '<tr><td style="padding: 10px; border-bottom: 1px solid #eee;">' + c.category + '</td><td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">' + c.total + '</td><td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">' + c.checked + '</td><td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">' + pct + '%</td></tr>';
      });
      detail += '</table>';
      document.getElementById('detailedReport').innerHTML = detail;
    })
    .catch(e => console.error('Error:', e));
}

// ===== ADD ATTENDEE =====
function addAttendee() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const category = document.getElementById('category').value;
  const ticketId = document.getElementById('ticketId').value;
  const eventId = document.getElementById('eventId').value;

  if (!name || !email) {
    document.getElementById('addMessage').innerHTML = '<div class="error">Name and email are required</div>';
    return;
  }

  fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, category, ticketId, eventId })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        document.getElementById('addMessage').innerHTML = '<div class="success">✓ Added! ID: ' + data.id + ' | QR: ' + data.qrCode + '</div>';
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('ticketId').value = '';
        document.getElementById('eventId').value = '';
        document.getElementById('category').value = '';
        loadData();
      } else {
        document.getElementById('addMessage').innerHTML = '<div class="error">Error: ' + (data.error || 'Failed') + '</div>';
      }
    })
    .catch(e => console.error('Error:', e));
}

// ===== CHECK-IN =====
function processCheckIn() {
  const input = document.getElementById('scanQR').value;
  const staffName = document.getElementById('staffName').value || 'Staff';

  if (!input) {
    alert('Enter QR code or Attendee ID');
    return;
  }

  fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrOrId: input, staffName: staffName })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        alert('✓ Checked in: ' + data.name);
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        alert('Error: ' + (data.error || 'Failed'));
      }
    })
    .catch(e => alert('Error: ' + e.message));
}

// ===== BADGE MANAGEMENT =====
function updateBadgeCount() {
  const selected = document.querySelectorAll('.badge-checkbox:checked').length;
  document.getElementById('selectedCount').textContent = selected;
}

function selectBadges(type) {
  const checkboxes = document.querySelectorAll('.badge-checkbox');
  checkboxes.forEach(cb => {
    if (type === 'all') cb.checked = true;
    else if (type === 'none') cb.checked = false;
  });
  updateBadgeCount();
}

function generateBadges() {
  const selected = Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    alert('Select at least one attendee');
    return;
  }

  const format = document.querySelector('input[name="badgeFormat"]:checked').value;
  
  fetch('/api/badges/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendeeIds: selected, format: format })
  })
    .then(r => {
      if (format === 'pdf') {
        return r.blob().then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'badges-' + new Date().toISOString().split('T')[0] + '.pdf';
          a.click();
        });
      } else {
        return r.text().then(html => {
          const w = window.open();
          w.document.write(html);
          w.document.close();
        });
      }
    })
    .catch(e => alert('Error: ' + e.message));
}

// ===== AUTO REFRESH =====
setInterval(loadData, 5000);
loadData();
</script>
</body>
</html>
  `);
});

// ===== API: ADD ATTENDEE =====
app.post('/api/add', async (req, res) => {
  const { name, email, phone, category, ticketId, eventId } = req.body;
  
  if (!name || !email) {
    return res.json({ success: false, error: 'Name and email required' });
  }

  try {
    const qrCode = ticketId || `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(
      `INSERT INTO attendees (name, email, phone, category, ticket_id, qr_code, event_id, registration_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, qr_code`,
      [name, email, phone || null, category || null, ticketId || null, qrCode, eventId || 'main-2026', 'manual']
    );

    if (result.rows.length > 0) {
      res.json({ success: true, id: result.rows[0].id, qrCode: result.rows[0].qr_code });
    } else {
      res.json({ success: false, error: 'Failed to add' });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== API: CHECK-IN =====
app.post('/api/checkin', async (req, res) => {
  const { qrOrId, staffName } = req.body;

  if (!qrOrId) {
    return res.json({ success: false, error: 'QR code or ID required' });
  }

  try {
    const query = isNaN(qrOrId) 
      ? 'SELECT * FROM attendees WHERE qr_code = $1'
      : 'SELECT * FROM attendees WHERE id = $1';
    
    const result = await pool.query(query, [qrOrId]);

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Attendee not found' });
    }

    const attendee = result.rows[0];

    if (attendee.checked_in) {
      return res.json({ success: false, error: 'Already checked in' });
    }

    await pool.query(
      `UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1
       WHERE id = $2`,
      [staffName || 'System', attendee.id]
    );

    res.json({ success: true, name: attendee.name, id: attendee.id });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== API: STATISTICS =====
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true THEN 1 END) as checked FROM attendees'
    );

    const total = parseInt(result.rows[0].total) || 0;
    const checked = parseInt(result.rows[0].checked) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;

    res.json({ total, checked, rate });
  } catch (err) {
    res.json({ total: 0, checked: 0, rate: 0 });
  }
});

// ===== API: BY CATEGORY =====
app.get('/api/stats/by-category', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT category, COUNT(*) as total, COUNT(CASE WHEN checked_in = true THEN 1 END) as checked
       FROM attendees GROUP BY category ORDER BY category`
    );
    res.json({ categories: result.rows });
  } catch (err) {
    res.json({ categories: [] });
  }
});

// ===== API: GET ATTENDEES =====
app.get('/api/attendees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, category, checked_in FROM attendees ORDER BY id DESC'
    );
    res.json({ attendees: result.rows });
  } catch (err) {
    res.json({ attendees: [] });
  }
});

// ===== API: RECENT CHECKINS =====
app.get('/api/checkins/recent', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT name, checked_in_at, checked_in_by FROM attendees 
       WHERE checked_in = true ORDER BY checked_in_at DESC LIMIT 20`
    );
    res.json({ checkins: result.rows });
  } catch (err) {
    res.json({ checkins: [] });
  }
});

// ===== API: GENERATE BADGES =====
app.post('/api/badges/generate', async (req, res) => {
  const { attendeeIds, format } = req.body;

  if (!attendeeIds || attendeeIds.length === 0) {
    return res.json({ error: 'No attendees selected' });
  }

  try {
    const placeholders = attendeeIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT id, name, email, category, qr_code FROM attendees WHERE id IN (${placeholders})`,
      attendeeIds
    );

    const attendees = result.rows;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="badges.pdf"');

      let pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 500 >>\nstream\nBT\n/F1 20 Tf\n50 700 Td\n(2026 Africa Convention - ID Badges) Tj\n0 -50 Td\n/F1 12 Tf\n';
      
      attendees.forEach((a, i) => {
        pdfContent += `(${a.name}) Tj\n0 -25 Td\n(${a.email}) Tj\n0 -25 Td\n`;
      });

      pdfContent += 'ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000203 00000 n\n0000000281 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n820\n%%EOF';
      
      res.send(pdfContent);
    } else {
      let html = `<html><head><title>ID Badges</title><style>body { font-family: Arial; margin: 20px; } .badge { display: inline-block; width: 3.5in; height: 2.2in; border: 2px solid #667eea; padding: 10px; margin: 10px; page-break-inside: avoid; } .badge-name { font-size: 18px; font-weight: bold; margin: 5px 0; } .badge-category { font-size: 12px; color: #666; } .badge-email { font-size: 10px; color: #999; margin: 5px 0; } .badge-qr { margin-top: 10px; text-align: center; } .badge-qr img { width: 80px; height: 80px; } </style></head><body>`;

      for (const attendee of attendees) {
        const qrDataUrl = await QRCode.toDataURL(attendee.qr_code);
        html += `<div class="badge"><div class="badge-name">${attendee.name}</div><div class="badge-category">${attendee.category || 'Attendee'}</div><div class="badge-email">${attendee.email}</div><div class="badge-qr"><img src="${qrDataUrl}"></div></div>`;
      }

      html += `</body></html>`;
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
  console.log('Dashboard: http://localhost:' + PORT);
});
