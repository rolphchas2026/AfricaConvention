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

// Static files
const baseDir = __dirname;
app.use(express.static(baseDir));
app.use('/sysimages', express.static(path.join(baseDir, 'sysimages')));
app.use('/documentation', express.static(path.join(baseDir, 'documentation')));

// Sessions
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
    trainingContent = '<div style="padding:20px;background:#fff3cd;border-radius:4px;"><h2>⚠ Training Not Found</h2></div>';
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

// ============= PUBLIC LANDING PAGE WITH GALLERY =============
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026 - Welcome</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .nav { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .nav h1 { font-size: 24px; }
    .nav a { color: white; text-decoration: none; padding: 10px 20px; background: rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer; }
    .nav a:hover { background: rgba(255,255,255,0.3); }
    
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 20px; text-align: center; }
    .header h2 { font-size: 36px; margin-bottom: 10px; }
    .header p { font-size: 16px; opacity: 0.9; }
    
    .banner-wrapper { display: flex; justify-content: center; padding: 30px 20px; background: white; }
    .header-banner { max-width: 100%; max-height: 350px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    .section { margin-bottom: 60px; }
    .section h2 { color: #667eea; font-size: 28px; margin-bottom: 30px; text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
    
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 30px 0; }
    .gallery-item { border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: 0.3s; }
    .gallery-item:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
    .gallery-item img { width: 100%; height: 220px; object-fit: cover; display: block; }
    .gallery-item-title { padding: 15px; background: white; text-align: center; font-size: 14px; color: #666; font-weight: 500; }
    
    .cta-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 20px; text-align: center; border-radius: 8px; margin: 40px 0; }
    .cta-section h2 { font-size: 32px; margin-bottom: 20px; }
    .cta-section p { font-size: 16px; margin-bottom: 30px; opacity: 0.9; }
    .cta-btn { background: white; color: #667eea; padding: 15px 40px; border: none; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer; }
    .cta-btn:hover { transform: scale(1.05); }
    
    .info { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .info h3 { color: #667eea; margin-bottom: 15px; }
    .info p { color: #666; line-height: 1.6; }
    
    .footer { background: #333; color: white; text-align: center; padding: 40px 20px; margin-top: 60px; }
    .footer p { margin: 8px 0; }
    .footer a { color: #667eea; text-decoration: none; }
    
    @media (max-width: 768px) {
      .nav { flex-direction: column; gap: 10px; }
      .header h2 { font-size: 24px; }
      .cta-section h2 { font-size: 24px; }
      .gallery { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<div class="nav">
  <h1>🎊 Africa Convention 2026</h1>
  <a onclick="window.location.href='/admin'">🔐 Admin Dashboard</a>
</div>

<div class="header">
  <h2>Welcome to Africa Convention 2026</h2>
  <p>Theme: "Doing Business and Bearing Fruitful" | June 18-22, 2026 | Arusha, Tanzania</p>
</div>

<div class="banner-wrapper">
  <img src="/sysimages/bronchour.jpeg" alt="Africa Convention 2026" class="header-banner" onerror="this.style.display='none'">
</div>

<div class="container">

<div class="section">
  <h2>📍 Event Venue</h2>
  <p style="text-align: center; color: #666; margin-bottom: 30px;">Discover our beautiful venue in Arusha, Tanzania</p>
  <div class="gallery">
    <div class="gallery-item">
      <img src="/sysimages/Venue_1.jpeg" alt="Venue 1">
      <div class="gallery-item-title">Main Building</div>
    </div>
    <div class="gallery-item">
      <img src="/sysimages/Venue_2.jpeg" alt="Venue 2">
      <div class="gallery-item-title">Entrance</div>
    </div>
    <div class="gallery-item">
      <img src="/sysimages/Venue_3.jpeg" alt="Venue 3">
      <div class="gallery-item-title">Grounds</div>
    </div>
    <div class="gallery-item">
      <img src="/sysimages/Venue_cornerstone_address.jpeg" alt="Cornerstone">
      <div class="gallery-item-title">Cornerstone</div>
    </div>
  </div>
</div>

<div class="section">
  <h2>🏛️ Interior Views</h2>
  <p style="text-align: center; color: #666; margin-bottom: 30px;">Beautiful interior spaces for the event</p>
  <div class="gallery">
    <div class="gallery-item">
      <img src="/sysimages/inside_church_bg_1.jpeg" alt="Interior 1">
      <div class="gallery-item-title">Main Hall</div>
    </div>
    <div class="gallery-item">
      <img src="/sysimages/inside_church_bg_2.jpeg" alt="Interior 2">
      <div class="gallery-item-title">Seating Area</div>
    </div>
    <div class="gallery-item">
      <img src="/sysimages/inside_church_bg_3.jpeg" alt="Interior 3">
      <div class="gallery-item-title">Lighting</div>
    </div>
  </div>
</div>

<div class="section">
  <h2>📋 Event Information</h2>
  <div class="gallery">
    <div class="gallery-item">
      <img src="/sysimages/youth_Summit_bronchour.jpeg" alt="Youth Summit">
      <div class="gallery-item-title">Youth Summit</div>
    </div>
    <div class="gallery-item">
      <img src="/sysimages/Bronchour_footer.jpeg" alt="Event Details">
      <div class="gallery-item-title">Event Details</div>
    </div>
  </div>
</div>

<div class="info">
  <h3>📅 Event Details</h3>
  <p><strong>Dates:</strong> June 18-22, 2026</p>
  <p><strong>Location:</strong> Arusha, Tanzania</p>
  <p><strong>Theme:</strong> "Doing Business and Bearing Fruitful"</p>
  <p><strong>Expected Attendance:</strong> 400-600 participants</p>
  <p style="margin-top: 15px;"><strong>Organizers:</strong> Living Hope Mission | WCCM | YWAM</p>
</div>

<div class="info">
  <h3>📞 Contact Information</h3>
  <p><strong>Phone:</strong> +255 787 576 900 | +255 713 276 655</p>
  <p><strong>Email:</strong> wccm.tz@gmail.com</p>
  <p><strong>Website:</strong> www.livinghope.or.tz</p>
</div>

<div class="cta-section">
  <h2>Ready to Register?</h2>
  <p>Access the admin dashboard to register attendees and manage the event</p>
  <button class="cta-btn" onclick="window.location.href='/admin'">Go to Admin Dashboard</button>
</div>

</div>

<div class="footer">
  <p>&copy; 2026 Africa Convention - Event Management System</p>
  <p>Designed by: <a href="mailto:raphayelchas@gmail.com">raphayelchas@gmail.com</a></p>
  <p>Organized by: Living Hope Mission | WCCM | YWAM | Arusha, Tanzania</p>
  <p style="margin-top: 20px; font-size: 12px; opacity: 0.7;">June 18-22, 2026 | Theme: "Doing Business and Bearing Fruitful"</p>
</div>

</body>
</html>`);
});

// ============= ADMIN LOGIN PAGE =============
app.get('/admin', (req, res) => {
  const token = req.query.token || '';
  
  // If already logged in, redirect to dashboard
  if (token && sessions[token]) {
    return res.redirect('/dashboard');
  }
  
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026 - Admin Login</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .login-container {
      background: white;
      padding: 50px;
      border-radius: 12px;
      box-shadow: 0 15px 50px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 420px;
    }
    .login-header {
      text-align: center;
      margin-bottom: 40px;
    }
    .login-header h1 {
      color: #667eea;
      font-size: 28px;
      margin-bottom: 15px;
    }
    .login-header p {
      color: #999;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .form-group {
      margin-bottom: 25px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 14px;
      border: 2px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 8px rgba(102, 126, 234, 0.2);
    }
    input::placeholder { color: #bbb; }
    
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: 0.3s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    }
    button:active { transform: translateY(0); }
    
    .alert {
      padding: 14px;
      margin-bottom: 25px;
      border-radius: 6px;
      display: none;
      background: #f8d7da;
      color: #721c24;
      border: 2px solid #f5c6cb;
      font-size: 14px;
    }
    .alert.show { display: block; }
    
    .credentials {
      background: #f0f4ff;
      padding: 20px;
      border-radius: 6px;
      margin-top: 30px;
      font-size: 13px;
      color: #1976d2;
      border: 2px solid #e3f2fd;
    }
    .credentials strong { display: block; margin-bottom: 10px; color: #667eea; font-size: 14px; }
    .credentials code {
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: bold;
    }
    .credentials-row { margin: 8px 0; display: flex; justify-content: space-between; align-items: center; }
    
    .back-link {
      display: inline-block;
      margin-top: 20px;
      text-align: center;
      width: 100%;
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .back-link:hover { text-decoration: underline; }
    
    .divider {
      text-align: center;
      margin: 25px 0;
      color: #ccc;
      font-size: 12px;
    }
  </style>
</head>
<body>

<div class="login-container">
  <div class="login-header">
    <h1>🔐 Admin Portal</h1>
    <p>Africa Convention 2026</p>
    <p>Event Management System</p>
  </div>

  <div id="errorAlert" class="alert"></div>

  <form onsubmit="handleLogin(event)">
    <div class="form-group">
      <label for="username">Username</label>
      <input type="text" id="username" placeholder="Enter username" autofocus required>
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="Enter password" required>
    </div>
    <button type="submit">🔓 Login</button>
  </form>

  <div class="divider">Demo Credentials</div>

  <div class="credentials">
    <strong>Test Account:</strong>
    <div class="credentials-row">
      <span>Username:</span>
      <code>admin</code>
    </div>
    <div class="credentials-row">
      <span>Password:</span>
      <code>Africa2026!</code>
    </div>
  </div>

  <a href="/" class="back-link">← Back to Gallery</a>
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
        window.location.href = '/dashboard';
      } else {
        const alert = document.getElementById('errorAlert');
        alert.textContent = '✗ ' + (data.error || 'Login failed');
        alert.classList.add('show');
      }
    })
    .catch(err => {
      const alert = document.getElementById('errorAlert');
      alert.textContent = '✗ Connection error';
      alert.classList.add('show');
    });
}
</script>

</body>
</html>`);
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

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) delete sessions[token];
  res.json({ success: true });
});

// ============= PROTECTED ADMIN DASHBOARD =============
app.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Dashboard - Africa Convention 2026</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 24px; }
    .logout-btn { background: #dc3545; padding: 10px 20px; border: none; border-radius: 4px; color: white; cursor: pointer; }
    .logout-btn:hover { background: #c82333; }
    
    .tabs { display: flex; background: white; border-bottom: 2px solid #667eea; overflow-x: auto; position: sticky; top: 0; z-index: 99; }
    .tab-btn { padding: 15px 20px; cursor: pointer; background: #f5f5f5; border: none; font-size: 14px; font-weight: 500; color: #333; white-space: nowrap; flex: 1; text-align: center; }
    .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .card { background: white; padding: 25px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card h2 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    input, select { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; }
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    button:hover { background: #764ba2; }
    
    label { display: block; margin: 15px 0 8px 0; color: #333; font-weight: 500; }
  </style>
</head>
<body>

<div class="header">
  <h1>🎊 Dashboard</h1>
  <button class="logout-btn" onclick="handleLogout()">🔓 Logout</button>
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="openTab(event, 'dashboard')">📊 Dashboard</button>
  <button class="tab-btn" onclick="openTab(event, 'checkin')">✅ Check-in</button>
  <button class="tab-btn" onclick="openTab(event, 'gallery')">🖼️ Gallery</button>
</div>

<div class="container">

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
        <div class="stat-label">Checked In</div>
      </div>
      <div class="stat">
        <div class="stat-number" id="rateStat">0%</div>
        <div class="stat-label">Check-in Rate</div>
      </div>
    </div>
  </div>
</div>

<div id="checkin" class="tab-content">
  <div class="card">
    <h2>Register New Attendee</h2>
    <div id="addMessage"></div>
    <label>Name:</label>
    <input type="text" id="name" placeholder="Full name" required>
    <label>Email:</label>
    <input type="email" id="email" placeholder="Email" required>
    <label>Category:</label>
    <select id="category">
      <option value="">Select</option>
      <option value="Youth">Youth</option>
      <option value="Speaker">Speaker</option>
      <option value="Business">Business</option>
    </select>
    <button onclick="addAttendee()" style="width: 100%; margin-top: 15px;">Register</button>
  </div>
</div>

<div id="gallery" class="tab-content">
  <div class="card">
    <h2>📸 Public Gallery</h2>
    <p><a href="/" target="_blank" style="color: #667eea; text-decoration: none; font-weight: bold;">View Public Gallery ↗</a></p>
  </div>
</div>

</div>

<script>
const authToken = localStorage.getItem('auth_token');
if (!authToken) { window.location.href = '/admin'; }

function handleLogout() {
  fetch('/api/logout', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + authToken }
  }).then(() => {
    localStorage.removeItem('auth_token');
    window.location.href = '/';
  });
}

function openTab(evt, tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  evt.currentTarget.classList.add('active');
  loadData();
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

function loadData() {
  apiCall('/api/stats').then(data => {
    document.getElementById('totalStat').textContent = data.total || 0;
    document.getElementById('checkedStat').textContent = data.checked || 0;
    document.getElementById('rateStat').textContent = (data.rate || 0) + '%';
  });
}

function addAttendee() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const category = document.getElementById('category').value;
  
  if (!name || !email) { alert('Name and email required'); return; }
  
  apiCall('/api/add', 'POST', { name, email, category }).then(data => {
    if (data.success) {
      alert('✓ Registered: ' + name);
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      document.getElementById('category').value = '';
      loadData();
    } else {
      alert('✗ ' + (data.error || 'Failed'));
    }
  });
}

loadData();
setInterval(loadData, 5000);
</script>

</body>
</html>`);
});

// ============= PUBLIC GALLERY API (No Auth) =============
app.get('/api/gallery', (req, res) => {
  const images = [
    { name: 'Venue 1', path: '/sysimages/Venue_1.jpeg' },
    { name: 'Venue 2', path: '/sysimages/Venue_2.jpeg' },
    { name: 'Venue 3', path: '/sysimages/Venue_3.jpeg' },
    { name: 'Cornerstone', path: '/sysimages/Venue_cornerstone_address.jpeg' },
    { name: 'Interior 1', path: '/sysimages/inside_church_bg_1.jpeg' },
    { name: 'Interior 2', path: '/sysimages/inside_church_bg_2.jpeg' },
    { name: 'Interior 3', path: '/sysimages/inside_church_bg_3.jpeg' }
  ];
  res.json({ success: true, images });
});

// ============= PROTECTED API ENDPOINTS =============

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
    await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP WHERE id = $1', [a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    res.json({ success: false, error: 'Error' });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true THEN 1 END) as checked FROM attendees');
    const total = parseInt(result.rows[0].total) || 0;
    const checked = parseInt(result.rows[0].checked) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    res.json({ total, checked, rate });
  } catch (err) {
    res.json({ total: 0, checked: 0, rate: 0 });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n✓ Server running on port ' + PORT);
  console.log('✓ Public Gallery: http://localhost:' + PORT);
  console.log('✓ Admin Login: http://localhost:' + PORT + '/admin\n');
});
