const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Ensure directories exist
const baseDir = __dirname;
const docsDir = path.join(baseDir, 'documentation');
const imagesDir = path.join(baseDir, 'sysimages');

// Create directories if they don't exist
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

app.use(cors());
app.use(express.json());

// Static file serving - MUST be before routes
app.use(express.static(baseDir));
app.use('/documentation', express.static(docsDir));
app.use('/sysimages', express.static(imagesDir));

// Session storage
const sessions = {};
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Africa2026!';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  database: process.env.DB_NAME || 'africa_convention'
});

// Load training content
let trainingContent = '';
function loadTraining() {
  const trainingPath = path.join(docsDir, 'training.html');
  try {
    if (fs.existsSync(trainingPath)) {
      trainingContent = fs.readFileSync(trainingPath, 'utf8');
      console.log('✓ Training loaded');
    } else {
      trainingContent = '<div style="padding:20px; background:#fff3cd; border-radius:4px; border-left:4px solid #ffc107;"><h2>⚠️ Training Not Found</h2><p>Place training.html in documentation/ folder</p></div>';
    }
  } catch (err) {
    console.warn('Training error:', err.message);
    trainingContent = '<div style="padding:20px; background:#fff3cd; border-radius:4px; border-left:4px solid #ffc107;"><h2>⚠️ Training Error</h2><p>' + err.message + '</p></div>';
  }
}

loadTraining();

// Get sponsor logos
function getSponsorLogos() {
  const sponsorDir = path.join(imagesDir, 'sponsors');
  let sponsors = [];
  try {
    if (fs.existsSync(sponsorDir)) {
      const files = fs.readdirSync(sponsorDir);
      sponsors = files
        .filter(f => f.startsWith('sponsor-') && (f.endsWith('.png') || f.endsWith('.jpeg') || f.endsWith('.jpg')))
        .map(f => ({
          name: f.replace('sponsor-', '').replace(/\.[^/.]+$/, ""),
          path: `/sysimages/sponsors/${f}`
        }));
    }
  } catch (err) {
    console.warn('Sponsors error:', err.message);
  }
  return sponsors;
}

// Middleware: Check authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions[token]) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// ============= LOGIN PAGE =============
app.get('/login', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026 - Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
    }
    .login-header {
      text-align: center;
      margin-bottom: 30px;
    }
    .login-header h1 {
      color: #667eea;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
    }
    button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
    .alert { padding: 12px; margin-bottom: 20px; border-radius: 4px; display: none; background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
    .credentials { background: #e3f2fd; padding: 15px; border-radius: 4px; margin-top: 20px; font-size: 12px; color: #1976d2; }
    .credentials code { background: #fff; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
<div class="login-container">
  <div class="login-header">
    <h1>🔐 Admin Login</h1>
    <p>Africa Convention 2026</p>
  </div>
  <div id="errorAlert" class="alert"></div>
  <form onsubmit="handleLogin(event)">
    <div class="form-group">
      <label>Username:</label>
      <input type="text" id="username" autofocus required>
    </div>
    <div class="form-group">
      <label>Password:</label>
      <input type="password" id="password" required>
    </div>
    <button type="submit">Login</button>
  </form>
  <div class="credentials">
    <strong>Demo Credentials:</strong><br><br>
    Username: <code>admin</code><br>
    Password: <code>Africa2026!</code>
  </div>
</div>
<script>
function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('auth_token', data.token);
        window.location.href = '/';
      } else {
        document.getElementById('errorAlert').textContent = data.error || 'Login failed';
        document.getElementById('errorAlert').style.display = 'block';
      }
    });
}
</script>
</body>
</html>
  `);
});

// ============= LOGIN API =============
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

// ============= LOGOUT API =============
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) delete sessions[token];
  res.json({ success: true });
});

// ============= MAIN DASHBOARD =============
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .header { background: white; padding: 15px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .logout-btn { padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .logout-btn:hover { background: #c82333; }
    
    .header-main { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header-main h1 { font-size: 28px; margin-bottom: 10px; }
    
    .banner-wrapper { display: flex; justify-content: center; padding: 20px; background: white; }
    .header-banner { max-width: 100%; max-height: 350px; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    
    .tabs { display: flex; background: white; border-bottom: 2px solid #667eea; overflow-x: auto; position: sticky; top: 70px; z-index: 99; }
    .tab-btn { padding: 15px 20px; cursor: pointer; background: #f5f5f5; border: none; font-size: 14px; font-weight: 500; color: #333; transition: 0.3s; white-space: nowrap; }
    .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
    .tab-btn:hover { background: #efefef; }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; width: 100%; }
    .card { background: white; padding: 25px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card h2 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
    .gallery-item { border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .gallery-item img { width: 100%; height: 200px; object-fit: cover; display: block; }
    .gallery-item-title { padding: 12px; background: white; text-align: center; font-size: 13px; color: #666; }
    
    input, select { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    input:focus, select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 5px rgba(102, 126, 234, 0.2); }
    
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin: 10px 10px 10px 0; }
    button:hover { background: #764ba2; }
    
    .alert { padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid; }
    .alert.success { background: #d4edda; color: #155724; border-color: #28a745; }
    .alert.error { background: #f8d7da; color: #721c24; border-color: #dc3545; }
    
    .footer { background: #f9f9f9; padding: 40px 20px; margin-top: 40px; border-top: 2px solid #667eea; text-align: center; }
    .footer p { font-size: 12px; color: #666; margin: 10px 0; }
    .footer a { color: #667eea; text-decoration: none; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    label { display: block; margin: 15px 0 8px 0; color: #333; font-weight: 500; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: bold; color: #333; }
  </style>
</head>
<body>

<div class="header">
  <div>Africa Convention 2026</div>
  <button class="logout-btn" onclick="handleLogout()">Logout</button>
</div>

<div class="header-main">
  <h1>🎊 Africa Convention 2026</h1>
  <p>Event Management System | June 18-22, 2026</p>
</div>

<div class="banner-wrapper">
  <img src="/sysimages/bronchour.jpeg" alt="Banner" class="header-banner" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22250%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3C/svg%3E'">
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="switchTab('dashboard')">📊 Dashboard</button>
  <button class="tab-btn" onclick="switchTab('gallery')">🖼️ Gallery</button>
  <button class="tab-btn" onclick="switchTab('checkin')">✅ Check-in</button>
  <button class="tab-btn" onclick="switchTab('badges')">🎫 Badges</button>
  <button class="tab-btn" onclick="switchTab('statistics')">📈 Statistics</button>
  <button class="tab-btn" onclick="switchTab('training')">🎓 Academy</button>
</div>

<div class="container">

  <!-- DASHBOARD TAB -->
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
      <h2>Activity Log</h2>
      <div id="activityLog" style="max-height: 400px; overflow-y: auto;"></div>
    </div>
  </div>

  <!-- GALLERY TAB -->
  <div id="gallery" class="tab-content">
    <div class="card">
      <h2>🖼️ Event Venue & Photos</h2>
      <p style="color: #666; margin-bottom: 20px;">Beautiful church venue in Arusha, Tanzania</p>
      <div class="gallery">
        <div class="gallery-item">
          <img src="/sysimages/Venue_1.jpeg" alt="Venue 1">
          <div class="gallery-item-title">Venue 1</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_2.jpeg" alt="Venue 2">
          <div class="gallery-item-title">Venue 2</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_3.jpeg" alt="Venue 3">
          <div class="gallery-item-title">Venue 3</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_cornerstone_address.jpeg" alt="Cornerstone">
          <div class="gallery-item-title">Cornerstone</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_1.jpeg" alt="Interior 1">
          <div class="gallery-item-title">Interior 1</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_2.jpeg" alt="Interior 2">
          <div class="gallery-item-title">Interior 2</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_3.jpeg" alt="Interior 3">
          <div class="gallery-item-title">Interior 3</div>
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
          <img src="/sysimages/Bronchour_footer.jpeg" alt="Footer">
          <div class="gallery-item-title">Event Info</div>
        </div>
      </div>
    </div>
  </div>

  <!-- CHECK-IN TAB -->
  <div id="checkin" class="tab-content">
    <div class="card">
      <h2>Register New Attendee</h2>
      <div id="addMessage"></div>
      <label>Full Name:</label>
      <input type="text" id="name" placeholder="Full name">
      <label>Email:</label>
      <input type="email" id="email" placeholder="Email">
      <label>Phone:</label>
      <input type="tel" id="phone" placeholder="Phone (optional)">
      <label>Category:</label>
      <select id="category">
        <option value="">Select Category</option>
        <option value="Youth">Youth</option>
        <option value="Speaker">Speaker</option>
        <option value="Business">Business</option>
        <option value="Staff">Staff</option>
      </select>
      <button onclick="addAttendee()" style="width: 100%; margin-top: 15px;">✅ Register</button>
    </div>

    <div class="card">
      <h2>Check-in / Check-out</h2>
      <div id="checkinMessage"></div>
      <label>QR Code or ID:</label>
      <input type="text" id="scanQR" placeholder="Scan QR or enter ID">
      <label>Staff Name:</label>
      <input type="text" id="staffName" placeholder="Your name">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
        <button onclick="processCheckIn()">✅ CHECK IN</button>
        <button onclick="processCheckOut()" style="background: #dc3545;">❌ CHECK OUT</button>
      </div>
    </div>
  </div>

  <!-- BADGES TAB -->
  <div id="badges" class="tab-content">
    <div class="card">
      <h2>Badge Generator</h2>
      <p style="color: #666; margin: 15px 0;">Generate ID badges for attendees</p>
      <label>Badge Format:</label>
      <select id="badgeFormat">
        <option value="pdf">PDF - Email to attendees</option>
        <option value="html">HTML - Print on-site</option>
      </select>
      <button onclick="generateBadges()" style="width: 100%; margin-top: 15px;">⬇️ Generate Badges</button>
    </div>
  </div>

  <!-- STATISTICS TAB -->
  <div id="statistics" class="tab-content">
    <div class="card">
      <h2>Event Statistics</h2>
      <div id="statsDisplay"></div>
    </div>
  </div>

  <!-- TRAINING TAB -->
  <div id="training" class="tab-content">
    <div class="card">
      <div id="trainingContent" style="min-height: 400px;">Loading training academy...</div>
    </div>
  </div>

</div>

<div class="footer">
  <p>&copy; 2026 Africa Convention - Event Management System</p>
  <p>Designed by: <a href="mailto:raphayelchas@gmail.com">raphayelchas@gmail.com</a></p>
  <p>Organized by: Living Hope Mission | WCCM | YWAM | Arusha, Tanzania</p>
  <p>June 18-22, 2026 | Theme: "Doing Business and Bearing Fruitful"</p>
</div>

<script>
const authToken = localStorage.getItem('auth_token');
if (!authToken) { window.location.href = '/login'; }

function handleLogout() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}

function switchTab(tabName) {
  // Hide all tabs
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Remove active from all buttons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  
  // Add active to clicked button
  event.target.classList.add('active');
  
  // Load content if needed
  if (tabName === 'training') {
    loadTraining();
  } else if (tabName === 'statistics') {
    loadStatistics();
  } else if (tabName === 'dashboard') {
    loadStats();
  }
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

function loadStats() {
  apiCall('/api/stats').then(data => {
    if (data.total !== undefined) {
      document.getElementById('totalStat').textContent = data.total || 0;
      document.getElementById('checkedStat').textContent = data.checked || 0;
      document.getElementById('checkedOutStat').textContent = data.checkedOut || 0;
      document.getElementById('rateStat').textContent = (data.rate || 0) + '%';
    }
  });
}

function loadTraining() {
  fetch('/documentation/training.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('trainingContent').innerHTML = html;
    })
    .catch(err => {
      document.getElementById('trainingContent').innerHTML = '<div style="padding:20px; background:#fff3cd; border-radius:4px; border-left:4px solid #ffc107;"><h2>⚠️ Training Not Found</h2><p>Expected: /documentation/training.html</p><p style="color:#666; font-size:12px; margin-top:15px;">Solution: Place training.html in documentation/ folder</p></div>';
    });
}

function loadStatistics() {
  apiCall('/api/stats').then(data => {
    let html = '<table><tr><th>Metric</th><th>Value</th></tr>';
    html += '<tr><td>Total Registered</td><td>' + (data.total || 0) + '</td></tr>';
    html += '<tr><td>In Event</td><td>' + (data.checked || 0) + '</td></tr>';
    html += '<tr><td>Checked Out</td><td>' + (data.checkedOut || 0) + '</td></tr>';
    html += '<tr><td>Check-in Rate</td><td>' + (data.rate || 0) + '%</td></tr>';
    html += '</table>';
    document.getElementById('statsDisplay').innerHTML = html;
  });
}

function addAttendee() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  if (!name || !email) {
    showAlert('Name and email required', 'error', 'addMessage');
    return;
  }
  apiCall('/api/add', 'POST', { name, email, phone: document.getElementById('phone').value, category: document.getElementById('category').value })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + name + ' registered!', 'success', 'addMessage');
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('category').value = '';
        loadStats();
      } else {
        showAlert(data.error || 'Failed', 'error', 'addMessage');
      }
    });
}

function processCheckIn() {
  const qr = document.getElementById('scanQR').value.trim();
  if (!qr) {
    showAlert('Enter QR or ID', 'error', 'checkinMessage');
    return;
  }
  apiCall('/api/checkin', 'POST', { qrOrId: qr, staffName: document.getElementById('staffName').value || 'System' })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + data.name + ' checked in', 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadStats();
      } else {
        showAlert(data.error || 'Failed', 'error', 'checkinMessage');
      }
    });
}

function processCheckOut() {
  const qr = document.getElementById('scanQR').value.trim();
  if (!qr) {
    showAlert('Enter QR or ID', 'error', 'checkinMessage');
    return;
  }
  apiCall('/api/checkout', 'POST', { qrOrId: qr, staffName: document.getElementById('staffName').value || 'System' })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + data.name + ' checked out', 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadStats();
      } else {
        showAlert(data.error || 'Failed', 'error', 'checkinMessage');
      }
    });
}

function generateBadges() {
  alert('Badge generation coming soon!');
}

function showAlert(msg, type, elementId) {
  const element = document.getElementById(elementId);
  element.innerHTML = '<div class="alert ' + type + '">' + msg + '</div>';
  if (type === 'success') setTimeout(() => { element.innerHTML = ''; }, 3000);
}

// Initial load
loadStats();
setInterval(loadStats, 5000);
</script>

</body>
</html>
  `);
});

// ============= API ENDPOINTS =============

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees');
    const total = parseInt(result.rows[0].total) || 0;
    const checked = parseInt(result.rows[0].checked) || 0;
    const checkedOut = parseInt(result.rows[0].checkedout) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    res.json({ total, checked, checkedOut, rate });
  } catch (err) {
    console.error('Stats error:', err);
    res.json({ total: 0, checked: 0, checkedOut: 0, rate: 0 });
  }
});

app.post('/api/add', requireAuth, async (req, res) => {
  const { name, email, phone, category } = req.body;
  if (!name || !email) return res.json({ success: false, error: 'Name and email required' });
  try {
    const result = await pool.query(
      'INSERT INTO attendees (name, email, phone, category, qr_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, email, phone || null, category || null, 'QR-' + Date.now()]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Add error:', err);
    res.json({ success: false, error: err.code === '23505' ? 'Email already exists' : 'Error adding attendee' });
  }
});

app.post('/api/checkin', requireAuth, async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Attendee not found' });
    const a = result.rows[0];
    if (a.checked_in && !a.checked_out) return res.json({ success: false, error: a.name + ' already checked in' });
    await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1, checked_out = false WHERE id = $2', [staffName || 'System', a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    console.error('Checkin error:', err);
    res.json({ success: false, error: 'Error' });
  }
});

app.post('/api/checkout', requireAuth, async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Attendee not found' });
    const a = result.rows[0];
    if (!a.checked_in) return res.json({ success: false, error: a.name + ' not checked in' });
    if (a.checked_out) return res.json({ success: false, error: a.name + ' already checked out' });
    await pool.query('UPDATE attendees SET checked_out = true, checked_out_at = CURRENT_TIMESTAMP WHERE id = $1', [a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    console.error('Checkout error:', err);
    res.json({ success: false, error: 'Error' });
  }
});

// ============= START SERVER =============
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     AFRICA CONVENTION 2026 - EVENT MANAGEMENT SYSTEM    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n✓ Server running on port ' + PORT);
  console.log('✓ Login: http://localhost:' + PORT + '/login');
  console.log('✓ Dashboard: http://localhost:' + PORT);
  console.log('✓ Credentials: admin / Africa2026!\n');
});
