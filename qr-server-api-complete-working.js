const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// STATIC FILE SERVING - CRITICAL FIX
const baseDir = __dirname;
app.use(express.static(baseDir));
app.use('/sysimages', express.static(path.join(baseDir, 'sysimages')));
app.use('/documentation', express.static(path.join(baseDir, 'documentation')));

// Session storage
const sessions = {};
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Africa2026!';

const pool = new Pool({
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  database: process.env.DB_NAME || 'africa_convention'
});

// Load training
let trainingContent = '';
function loadTraining() {
  try {
    trainingContent = fs.readFileSync(path.join(baseDir, 'documentation/training.html'), 'utf8');
  } catch (err) {
    trainingContent = '<div style="padding:20px;background:#fff3cd;border-radius:4px;margin:20px;"><h2>⚠ Training Not Found</h2><p>Place training.html in documentation/ folder</p></div>';
  }
}
loadTraining();

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions[token]) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// ============= LOGIN PAGE =============
app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Login</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;height:100vh}.login-container{background:white;padding:40px;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.3);width:100%;max-width:400px;margin:20px}.login-header{text-align:center;margin-bottom:30px}.login-header h1{color:#667eea;font-size:24px;margin-bottom:10px}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#333;font-weight:500}input{width:100%;padding:12px;border:1px solid #ddd;border-radius:4px;font-size:14px}input:focus{outline:none;border-color:#667eea;box-shadow:0 0 5px rgba(102,126,234,0.3)}button{width:100%;padding:12px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:4px;font-size:16px;font-weight:bold;cursor:pointer}button:hover{transform:translateY(-2px);box-shadow:0 5px 15px rgba(0,0,0,0.2)}.alert{padding:12px;margin-bottom:20px;border-radius:4px;display:none;background:#f8d7da;color:#721c24;border-left:4px solid #dc3545}.credentials{background:#e3f2fd;padding:15px;border-radius:4px;margin-top:20px;font-size:12px;color:#1976d2}.credentials code{background:#fff;padding:2px 5px;border-radius:3px;font-family:monospace}</style></head><body><div class="login-container"><div class="login-header"><h1>🔐 Admin Login</h1><p>Africa Convention 2026</p></div><div id="errorAlert" class="alert"></div><form onsubmit="handleLogin(event)"><div class="form-group"><label>Username:</label><input type="text" id="username" autofocus required></div><div class="form-group"><label>Password:</label><input type="password" id="password" required></div><button type="submit">Login</button></form><div class="credentials"><strong>Demo:</strong><br><code>admin</code> / <code>Africa2026!</code></div></div><script>function handleLogin(event){event.preventDefault();const username=document.getElementById('username').value.trim();const password=document.getElementById('password').value.trim();fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}).then(r=>r.json()).then(data=>{if(data.success){localStorage.setItem('auth_token',data.token);window.location.href='/';}else{document.getElementById('errorAlert').textContent=data.error||'Login failed';document.getElementById('errorAlert').style.display='block';}});}</script></body></html>`);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions[token] = { userId: 'admin', userName: username };
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) delete sessions[token];
  res.json({ success: true });
});

// ============= MAIN DASHBOARD =============
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { font-size: 14px; opacity: 0.9; }
    
    .banner-wrapper { display: flex; justify-content: center; padding: 20px; background: white; }
    .header-banner { max-width: 100%; max-height: 350px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    
    .tabs { display: flex; background: white; border-bottom: 2px solid #667eea; overflow-x: auto; position: sticky; top: 0; z-index: 99; }
    .tab-btn { padding: 15px 20px; cursor: pointer; background: #f5f5f5; border: none; font-size: 14px; font-weight: 500; color: #333; white-space: nowrap; flex: 1; text-align: center; }
    .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
    .tab-btn:hover { background: #efefef; }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .card { background: white; padding: 25px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card h2 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    
    input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    input:focus, select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 5px rgba(102,126,234,0.2); }
    
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin: 10px 0; }
    button:hover { background: #764ba2; }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
    .gallery-item { border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .gallery-item img { width: 100%; height: 200px; object-fit: cover; display: block; }
    .gallery-item-title { padding: 12px; background: white; text-align: center; font-size: 13px; color: #666; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    .footer { text-align: center; padding: 30px 20px; background: #333; color: white; font-size: 12px; margin-top: 40px; }
    .footer a { color: #667eea; text-decoration: none; }
    
    .loading { text-align: center; padding: 40px 20px; color: #999; }
    
    label { display: block; margin: 15px 0 8px 0; color: #333; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: bold; }
    
    .alert { padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid; }
    .alert.success { background: #d4edda; color: #155724; border-color: #28a745; }
    .alert.error { background: #f8d7da; color: #721c24; border-color: #dc3545; }
    
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>

<div class="header">
  <h1>🎊 Africa Convention 2026</h1>
  <p>Event Management System | June 18-22, 2026 | Arusha, Tanzania</p>
</div>

<div class="banner-wrapper">
  <img src="/sysimages/bronchour.jpeg" alt="Banner" class="header-banner" onerror="this.style.display='none'">
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="openTab(event, 'dashboard')">📊 Dashboard</button>
  <button class="tab-btn" onclick="openTab(event, 'gallery')">🖼️ Gallery</button>
  <button class="tab-btn" onclick="openTab(event, 'checkin')">✅ Check-in</button>
  <button class="tab-btn" onclick="openTab(event, 'badges')">🎫 Badges</button>
  <button class="tab-btn" onclick="openTab(event, 'statistics')">📈 Stats</button>
  <button class="tab-btn" onclick="openTab(event, 'training')">🎓 Academy</button>
</div>

<div class="container">

<!-- DASHBOARD -->
<div id="dashboard" class="tab-content active">
  <div class="card">
    <h2>Real-time Statistics</h2>
    <div class="stats">
      <div class="stat">
        <div class="stat-number" id="totalStat">0</div>
        <div class="stat-label">Total Registered</div>
      </div>
      <div class="stat">
        <div class="stat-number" id="checkedStat">0</div>
        <div class="stat-label">In Event</div>
      </div>
      <div class="stat">
        <div class="stat-number" id="checkedOutStat">0</div>
        <div class="stat-label">Checked Out</div>
      </div>
      <div class="stat">
        <div class="stat-number" id="rateStat">0%</div>
        <div class="stat-label">Check-in Rate</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Recent Activity</h2>
    <div id="recentActivity" style="max-height: 400px; overflow-y: auto;"></div>
  </div>
</div>

<!-- GALLERY -->
<div id="gallery" class="tab-content">
  <div class="card">
    <h2>🖼️ Venue Gallery</h2>
    <div class="gallery">
      <div class="gallery-item">
        <img src="/sysimages/Venue_1.jpeg" alt="Venue 1">
        <div class="gallery-item-title">Venue Exterior</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/Venue_2.jpeg" alt="Venue 2">
        <div class="gallery-item-title">Venue Gate</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/Venue_3.jpeg" alt="Venue 3">
        <div class="gallery-item-title">Venue Angle</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/Venue_cornerstone_address.jpeg" alt="Cornerstone">
        <div class="gallery-item-title">Cornerstone Address</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/inside_church_bg_1.jpeg" alt="Interior 1">
        <div class="gallery-item-title">Interior Main</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/inside_church_bg_2.jpeg" alt="Interior 2">
        <div class="gallery-item-title">Interior Seating</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/inside_church_bg_3.jpeg" alt="Interior 3">
        <div class="gallery-item-title">Interior View</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>📋 Event Brochures</h2>
    <div class="gallery">
      <div class="gallery-item">
        <img src="/sysimages/youth_Summit_bronchour.jpeg" alt="Youth Summit">
        <div class="gallery-item-title">Youth Summit</div>
      </div>
      <div class="gallery-item">
        <img src="/sysimages/Bronchour_footer.jpeg" alt="Event Brochure">
        <div class="gallery-item-title">Event Brochure</div>
      </div>
    </div>
  </div>
</div>

<!-- CHECK-IN -->
<div id="checkin" class="tab-content">
  <div class="card">
    <h2>Register New Attendee</h2>
    <div id="addMessage"></div>
    <div class="form-row">
      <div>
        <label>Full Name:</label>
        <input type="text" id="name" placeholder="Full name" required>
      </div>
      <div>
        <label>Email Address:</label>
        <input type="email" id="email" placeholder="Email" required>
      </div>
    </div>
    <div class="form-row">
      <div>
        <label>Phone Number:</label>
        <input type="tel" id="phone" placeholder="Phone (optional)">
      </div>
      <div>
        <label>Category:</label>
        <select id="category">
          <option value="">Select Category</option>
          <option value="Youth">Youth</option>
          <option value="Speaker">Speaker</option>
          <option value="Business">Business</option>
          <option value="Staff">Staff</option>
        </select>
      </div>
    </div>
    <button onclick="addAttendee()" class="btn-success" style="width: 100%; padding: 15px; font-size: 16px;">✅ Register Attendee</button>
  </div>

  <div class="card">
    <h2>Check-in / Check-out</h2>
    <div id="checkinMessage"></div>
    <label>QR Code or Attendee ID:</label>
    <input type="text" id="scanQR" placeholder="Scan QR or enter ID" autofocus>
    <label>Staff Member Name:</label>
    <input type="text" id="staffName" placeholder="Your name">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
      <button onclick="processCheckIn()" class="btn-success" style="padding: 15px; font-size: 16px;">✅ CHECK IN</button>
      <button onclick="processCheckOut()" class="btn-danger" style="padding: 15px; font-size: 16px;">❌ CHECK OUT</button>
    </div>
  </div>

  <div class="card">
    <h2>Recent Check-ins</h2>
    <div id="checkinLog" style="max-height: 400px; overflow-y: auto;"></div>
  </div>
</div>

<!-- BADGES -->
<div id="badges" class="tab-content">
  <div class="card">
    <h2>Badge Generator</h2>
    <div id="badgeMessage"></div>
    <label>Badge Format:</label>
    <div style="margin: 20px 0;">
      <input type="radio" name="badgeFormat" value="pdf" checked> PDF (Email)
      <input type="radio" name="badgeFormat" value="html" style="margin-left: 20px;"> HTML (Print)
    </div>
    <button onclick="selectBadges('all')">Select All</button>
    <button onclick="selectBadges('none')">Clear All</button>
    <div style="max-height: 400px; overflow-y: auto; border: 2px solid #ddd; padding: 15px; margin: 20px 0; border-radius: 4px; background: #fafafa;">
      <div id="attendeeCheckboxes"><div class="loading">Loading attendees...</div></div>
    </div>
    <button onclick="generateBadges()" style="width: 100%; background: #28a745; padding: 20px; font-size: 16px; font-weight: bold;">⬇️ Generate Badges</button>
  </div>
</div>

<!-- STATISTICS -->
<div id="statistics" class="tab-content">
  <div class="card">
    <h2>Detailed Statistics</h2>
    <div id="statsDetail"></div>
  </div>
</div>

<!-- TRAINING -->
<div id="training" class="tab-content">
  <div class="card">
    <div id="trainingContent"><div class="loading">Loading training academy...</div></div>
  </div>
</div>

</div>

<div class="footer">
  <p>&copy; 2026 Africa Convention - Event Management System</p>
  <p>Designed by: <a href="mailto:raphayelchas@gmail.com">raphayelchas@gmail.com</a></p>
  <p>Organized by: Living Hope Mission | WCCM | YWAM | Arusha, Tanzania</p>
</div>

<script>
const authToken = localStorage.getItem('auth_token');
if (!authToken) { window.location.href = '/login'; }

function openTab(evt, tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  evt.currentTarget.classList.add('active');
  
  if (tabName === 'training') loadTraining();
  else loadData();
}

function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + authToken
    }
  };
  if (body) options.body = JSON.stringify(body);
  return fetch(endpoint, options).then(r => r.json());
}

function loadTraining() {
  fetch('/documentation/training.html')
    .then(r => r.ok ? r.text() : Promise.reject('Not found'))
    .then(html => { document.getElementById('trainingContent').innerHTML = html; })
    .catch(err => { document.getElementById('trainingContent').innerHTML = '<div style="padding:20px;background:#fff3cd;border-radius:4px;margin:20px;"><h2>⚠ Training Not Found</h2><p>Place training.html in documentation/ folder</p></div>'; });
}

function loadData() {
  loadStats();
  loadRecentActivity();
  loadAttendeeList();
}

function loadStats() {
  apiCall('/api/stats').then(data => {
    document.getElementById('totalStat').textContent = data.total || 0;
    document.getElementById('checkedStat').textContent = data.checked || 0;
    document.getElementById('checkedOutStat').textContent = data.checkedOut || 0;
    document.getElementById('rateStat').textContent = (data.rate || 0) + '%';
  });
}

function loadRecentActivity() {
  apiCall('/api/activity/recent').then(data => {
    const activities = data.activities || [];
    let html = activities.length === 0 ? '<p style="color: #999;">No activity yet</p>' : '';
    activities.forEach(a => {
      const time = new Date(a.timestamp).toLocaleTimeString();
      const badge = a.action === 'CHECK_IN' ? '<span style="background: #28a745; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">✓</span>' : '<span style="background: #dc3545; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">✗</span>';
      html += '<div style="padding:12px;background:#f9f9f9;margin:8px 0;border-left:4px solid #667eea;border-radius:4px;"><strong>' + a.name + '</strong> ' + badge + ' <span style="float:right;color:#999;font-size:12px;">' + time + '</span></div>';
    });
    document.getElementById('recentActivity').innerHTML = html;
    document.getElementById('checkinLog').innerHTML = html;
  });
}

function loadAttendeeList() {
  apiCall('/api/attendees').then(data => {
    const attendees = data.attendees || [];
    let html = '';
    attendees.forEach(a => {
      html += '<label style="padding:10px;margin:5px 0;background:#f5f5f5;border-radius:4px;display:block;cursor:pointer;"><input type="checkbox" class="badge-checkbox" value="' + a.id + '"> <strong>' + a.name + '</strong> (' + a.category + ')</label>';
    });
    document.getElementById('attendeeCheckboxes').innerHTML = html || '<p>No attendees yet</p>';
    document.querySelectorAll('.badge-checkbox').forEach(cb => cb.addEventListener('change', () => {
      document.getElementById('selectedCount').textContent = document.querySelectorAll('.badge-checkbox:checked').length;
    }));
  });
}

function addAttendee() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const category = document.getElementById('category').value;

  if (!name || name.length < 2) { showAlert('Name must be at least 2 characters', 'error', 'addMessage'); return; }
  if (!email) { showAlert('Email is required', 'error', 'addMessage'); return; }

  apiCall('/api/add', 'POST', { name, email, phone, category }).then(data => {
    if (data.success) {
      showAlert('✓ ' + name + ' registered!', 'success', 'addMessage');
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('category').value = '';
      loadData();
    } else {
      showAlert(data.error || 'Failed', 'error', 'addMessage');
    }
  });
}

function processCheckIn() {
  const input = document.getElementById('scanQR').value.trim();
  if (!input) { showAlert('Enter QR or ID', 'error', 'checkinMessage'); return; }
  apiCall('/api/checkin', 'POST', { qrOrId: input, staffName: document.getElementById('staffName').value.trim() || 'System' })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + data.name + ' checked in', 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Failed', 'error', 'checkinMessage');
      }
    });
}

function processCheckOut() {
  const input = document.getElementById('scanQR').value.trim();
  if (!input) { showAlert('Enter QR or ID', 'error', 'checkinMessage'); return; }
  apiCall('/api/checkout', 'POST', { qrOrId: input, staffName: document.getElementById('staffName').value.trim() || 'System' })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + data.name + ' checked out', 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Failed', 'error', 'checkinMessage');
      }
    });
}

function selectBadges(type) {
  document.querySelectorAll('.badge-checkbox').forEach(cb => cb.checked = (type === 'all'));
}

function generateBadges() {
  const selected = Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value);
  if (selected.length === 0) { showAlert('Select attendees', 'error', 'badgeMessage'); return; }
  const format = document.querySelector('input[name="badgeFormat"]:checked').value;
  apiCall('/api/badges/generate', 'POST', { attendeeIds: selected, format: format }).then(r => {
    if (format === 'pdf') {
      return r.blob().then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'badges.pdf';
        a.click();
      });
    } else {
      return r.text().then(html => { const w = window.open(); w.document.write(html); });
    }
  });
}

function showAlert(msg, type, id) {
  document.getElementById(id).innerHTML = '<div class="alert ' + type + '">' + msg + '</div>';
  if (type === 'success') setTimeout(() => document.getElementById(id).innerHTML = '', 3000);
}

loadData();
setInterval(loadData, 5000);
</script>

</body>
</html>`);
});

// ============= API ENDPOINTS =============

app.post('/api/add', requireAuth, async (req, res) => {
  const { name, email, phone, category } = req.body;
  if (!name || !email) return res.json({ success: false, error: 'Name and email required' });
  try {
    const result = await pool.query(
      'INSERT INTO attendees (name, email, phone, category, qr_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, email, phone || null, category || null, `QR-${Date.now()}`]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.json({ success: false, error: 'Error: ' + err.message });
  }
});

app.post('/api/checkin', requireAuth, async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Not found' });
    const a = result.rows[0];
    if (a.checked_in && !a.checked_out) return res.json({ success: false, error: 'Already checked in' });
    await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1, checked_out = false WHERE id = $2', [staffName, a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    res.json({ success: false, error: 'Error' });
  }
});

app.post('/api/checkout', requireAuth, async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Not found' });
    const a = result.rows[0];
    if (!a.checked_in) return res.json({ success: false, error: 'Not checked in' });
    await pool.query('UPDATE attendees SET checked_out = true, checked_out_at = CURRENT_TIMESTAMP WHERE id = $1', [a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    res.json({ success: false, error: 'Error' });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees');
    const total = parseInt(result.rows[0].total) || 0;
    const checked = parseInt(result.rows[0].checked) || 0;
    const checkedOut = parseInt(result.rows[0].checkedout) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    res.json({ total, checked, checkedOut, rate });
  } catch (err) {
    res.json({ total: 0, checked: 0, checkedOut: 0, rate: 0 });
  }
});

app.get('/api/activity/recent', requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT name, checked_in_at as timestamp, 'CHECK_IN' as action FROM attendees WHERE checked_in = true ORDER BY checked_in_at DESC LIMIT 20");
    res.json({ activities: result.rows });
  } catch (err) {
    res.json({ activities: [] });
  }
});

app.get('/api/attendees', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, category FROM attendees ORDER BY id DESC');
    res.json({ attendees: result.rows });
  } catch (err) {
    res.json({ attendees: [] });
  }
});

app.post('/api/badges/generate', requireAuth, async (req, res) => {
  const { attendeeIds, format } = req.body;
  if (!attendeeIds || attendeeIds.length === 0) return res.status(400).json({ error: 'Select attendees' });
  try {
    const placeholders = attendeeIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`SELECT id, name, email, category FROM attendees WHERE id IN (${placeholders})`, attendeeIds);
    const attendees = result.rows;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="badges.pdf"');
      let pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 200 >>\nstream\nBT\n/F1 20 Tf\n50 750 Td\n(BADGES) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n900\n%%EOF';
      res.send(pdf);
    } else {
      let html = '<!DOCTYPE html><html><head><title>Badges</title><meta name="viewport" content="width=device-width"><style>body{margin:20px;font-family:Arial}.badge{display:inline-block;width:3.5in;height:2.2in;border:2px solid #667eea;padding:15px;margin:10px;text-align:center;background:white}.badge-name{font-size:18px;font-weight:bold}.badge-cat{font-size:13px;color:#667eea}@media print{body{margin:0}.badge{margin:5px}}</style></head><body>';
      attendees.forEach(a => {
        html += '<div class="badge"><div class="badge-name">' + a.name + '</div><div class="badge-cat">' + a.category + '</div></div>';
      });
      html += '</body></html>';
      res.send(html);
    }
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n✓ Server running on port ' + PORT);
  console.log('✓ Login: http://localhost:' + PORT + '/login\n');
});
