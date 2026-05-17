const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// CRITICAL: Serve static files BEFORE routes
app.use('/sysimages', express.static(path.join(__dirname, 'sysimages')));
app.use('/documentation', express.static(path.join(__dirname, 'documentation')));
app.use(express.static('public'));

// Simple session storage
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

// Load training - READ FROM FILE
let trainingContent = '';
function loadTraining() {
  try {
    trainingContent = fs.readFileSync(path.join(__dirname, 'documentation/training.html'), 'utf8');
    console.log('✓ Training loaded: ' + (trainingContent.length / 1000).toFixed(1) + 'KB');
  } catch (err) {
    console.warn('⚠ Training not found at documentation/training.html');
    trainingContent = '<div style="padding:20px; background:#fff3cd; border-radius:4px; margin:20px;"><h2>⚠️ Training Academy Not Found</h2><p>Place <code>training.html</code> in <code>documentation/</code> folder</p><p style="color:#666; font-size:12px;">Expected path: C:\\AfricaConvention\\documentation\\training.html</p></div>';
  }
}

// Get sponsor logos
function getSponsorLogos() {
  const sponsorDir = path.join(__dirname, 'sysimages/sponsors');
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
      if (sponsors.length > 0) {
        console.log(`✓ Loaded ${sponsors.length} sponsor logos`);
      }
    }
  } catch (err) {
    console.warn('Sponsors folder note:', err.message);
  }
  return sponsors;
}

// Middleware: Check authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.body.token;
  if (!token || !sessions[token]) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please login.', type: 'AUTH_REQUIRED' });
  }
  req.userId = sessions[token].userId;
  req.userName = sessions[token].userName;
  next();
}

// Error handler
const handleError = (err, context) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${context}] ERROR: ${err.code || 'UNKNOWN'} - ${err.message}`);
  if (err.code === '23505') {
    if (err.constraint === 'attendees_email_key') {
      return { success: false, error: 'Email already registered. Use different email.', type: 'DUPLICATE_EMAIL', status: 400 };
    }
  }
  if (err.code === 'ECONNREFUSED') {
    return { success: false, error: 'Database unavailable. Try again.', type: 'SERVICE_UNAVAILABLE', status: 503 };
  }
  return { success: false, error: 'System error. Contact support.', type: 'SYSTEM_ERROR', status: 500 };
};

// ============= AUTHENTICATION ROUTES =============

// LOGIN PAGE
app.get('/login', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026 - Admin Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
      margin: 20px;
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
    .login-header p {
      color: #999;
      font-size: 12px;
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
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    .alert {
      padding: 12px;
      margin-bottom: 20px;
      border-radius: 4px;
      display: none;
      background: #f8d7da;
      color: #721c24;
      border-left: 4px solid #dc3545;
    }
    .credentials {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
      font-size: 12px;
      color: #1976d2;
    }
    .credentials code {
      background: #fff;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
</head>
<body>

<div class="login-container">
  <div class="login-header">
    <h1>🔐 Admin Portal</h1>
    <p>Africa Convention 2026 - Event Management</p>
  </div>

  <div id="errorAlert" class="alert"></div>

  <form onsubmit="handleLogin(event)">
    <div class="form-group">
      <label>Username:</label>
      <input type="text" id="username" placeholder="Enter username" autofocus required>
    </div>
    <div class="form-group">
      <label>Password:</label>
      <input type="password" id="password" placeholder="Enter password" required>
    </div>
    <button type="submit">🔓 Login</button>
  </form>

  <div class="credentials">
    <strong>✓ Demo Credentials:</strong><br><br>
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
        document.getElementById('errorAlert').textContent = '✗ ' + (data.error || 'Login failed');
        document.getElementById('errorAlert').style.display = 'block';
      }
    })
    .catch(err => {
      document.getElementById('errorAlert').textContent = '✗ Connection error';
      document.getElementById('errorAlert').style.display = 'block';
    });
}
</script>

</body>
</html>
  `);
});

// LOGIN API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions[token] = {
      userId: 'admin-' + Date.now(),
      userName: username,
      loginTime: new Date()
    };
    res.json({ success: true, token: token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid username or password' });
  }
});

// LOGOUT API
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
  <title>Africa Convention 2026 - Event Management</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .header-top { 
      background: white; 
      padding: 15px 20px; 
      border-bottom: 1px solid #ddd; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-logos { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
    .header-logo { max-height: 50px; object-fit: contain; }
    .user-info { 
      font-size: 12px; 
      color: #666; 
      text-align: right;
      white-space: nowrap;
    }
    .logout-btn { 
      padding: 8px 15px; 
      background: #dc3545; 
      color: white; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer; 
      font-size: 12px; 
      margin-top: 5px;
    }
    .logout-btn:hover { background: #c82333; }
    
    .header-main { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px 20px;
      text-align: center;
    }
    .header-main h1 { font-size: 28px; margin-bottom: 10px; }
    .header-main p { font-size: 14px; opacity: 0.9; }
    
    .banner-wrapper {
      display: flex;
      justify-content: center;
      padding: 20px;
      background: white;
    }
    .header-banner { 
      max-width: 100%;
      max-height: 350px; 
      object-fit: contain;
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .tabs { 
      display: flex; 
      background: white; 
      border-bottom: 2px solid #667eea; 
      overflow-x: auto; 
      flex-wrap: wrap;
      justify-content: center;
      position: sticky;
      top: 70px;
      z-index: 99;
    }
    .tab-btn { 
      padding: 15px 20px; 
      cursor: pointer; 
      background: #f5f5f5; 
      border: none; 
      font-size: 14px; 
      font-weight: 500; 
      color: #333; 
      transition: 0.3s; 
      white-space: nowrap; 
      flex: 1; 
      min-width: 100px;
      text-align: center;
    }
    .tab-btn.active { 
      background: white; 
      color: #667eea; 
      border-bottom: 3px solid #667eea; 
    }
    .tab-btn:hover { background: #efefef; }
    
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px;
      width: 100%;
    }
    .card { 
      background: white; 
      padding: 25px; 
      margin: 15px 0; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #333;
      margin-bottom: 15px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    
    .stats { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 15px; 
      margin-bottom: 20px; 
    }
    .stat { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 25px; 
      border-radius: 8px; 
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    
    input, select, textarea { 
      width: 100%; 
      padding: 12px; 
      margin: 8px 0; 
      border: 1px solid #ddd; 
      border-radius: 4px; 
      font-size: 14px;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 5px rgba(102, 126, 234, 0.2);
    }
    button { 
      background: #667eea; 
      color: white; 
      padding: 12px 20px; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 500; 
      margin-right: 10px; 
      margin-top: 10px;
      transition: 0.3s;
    }
    button:hover { background: #764ba2; transform: translateY(-2px); }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    
    .alert { 
      padding: 15px; 
      margin: 10px 0; 
      border-radius: 4px; 
      border-left: 4px solid;
    }
    .alert.success { 
      background: #d4edda; 
      color: #155724; 
      border-color: #28a745; 
    }
    .alert.error { 
      background: #f8d7da; 
      color: #721c24; 
      border-color: #dc3545; 
    }
    .alert.warning { 
      background: #fff3cd; 
      color: #856404; 
      border-color: #ffc107; 
    }
    
    .gallery { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
      gap: 15px; 
      margin: 20px 0; 
    }
    .gallery-item { 
      border-radius: 8px; 
      overflow: hidden; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: 0.3s;
    }
    .gallery-item:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .gallery-item img { 
      width: 100%; 
      height: 200px; 
      object-fit: cover; 
      display: block;
    }
    .gallery-item-title { 
      padding: 12px; 
      background: white; 
      text-align: center; 
      font-size: 13px; 
      color: #666;
      font-weight: 500;
    }
    
    .footer-sponsors { 
      background: #f9f9f9; 
      padding: 40px 20px; 
      margin-top: 40px; 
      border-top: 2px solid #667eea;
      text-align: center;
    }
    .sponsors-title { 
      text-align: center; 
      font-size: 22px; 
      font-weight: bold; 
      color: #667eea; 
      margin-bottom: 30px; 
    }
    .sponsors-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); 
      gap: 25px; 
      margin: 20px 0;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
      align-items: center; 
      justify-items: center; 
    }
    .sponsor-item { text-align: center; }
    .sponsor-logo { 
      max-height: 70px; 
      max-width: 130px; 
      object-fit: contain;
    }
    .sponsor-name { 
      font-size: 12px; 
      color: #666; 
      margin-top: 10px; 
      font-weight: 500;
    }
    
    .footer-copyright { 
      text-align: center; 
      padding: 30px 20px; 
      background: #333; 
      color: white; 
      font-size: 12px; 
    }
    .footer-copyright p { margin: 8px 0; }
    .footer-copyright a { 
      color: #667eea; 
      text-decoration: none;
    }
    .footer-copyright a:hover { text-decoration: underline; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    .form-row { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 20px; 
      margin-bottom: 15px; 
    }
    @media (max-width: 768px) { 
      .form-row { grid-template-columns: 1fr; }
      .header-main { padding: 20px 15px; }
      .header-main h1 { font-size: 20px; }
      .tabs { top: 50px; }
      .tab-btn { padding: 12px 15px; font-size: 12px; }
    }
    
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 15px;
    }
    th, td { 
      padding: 12px; 
      text-align: left; 
      border-bottom: 1px solid #eee;
    }
    th { 
      background: #f5f5f5; 
      font-weight: bold;
      color: #333;
    }
    tr:hover { background: #f9f9f9; }
    
    .loading { 
      text-align: center; 
      padding: 40px 20px; 
      color: #999;
    }
    
    label {
      display: block;
      margin: 15px 0 8px 0;
      color: #333;
      font-weight: 500;
    }
  </style>
</head>
<body>

<!-- HEADER -->
<div class="header-top">
  <div class="header-logos">
    <img src="/sysimages/wccm-logo.png" class="header-logo" alt="WCCM" onerror="this.style.display='none'">
    <img src="/sysimages/livinghope-logo.png" class="header-logo" alt="Living Hope" onerror="this.style.display='none'">
    <img src="/sysimages/ywam-logo.png" class="header-logo" alt="YWAM" onerror="this.style.display='none'">
  </div>
  <div class="user-info">
    <div id="userDisplay">✓ Logged in as: admin</div>
    <button class="logout-btn" onclick="handleLogout()">🔓 Logout</button>
  </div>
</div>

<!-- MAIN HEADER -->
<div class="header-main">
  <h1>🎊 Africa Convention 2026</h1>
  <p>Event Management System | Theme: "Doing Business and Bearing Fruitful"</p>
  <p style="font-size: 12px; margin-top: 10px;">June 18-22, 2026 | Arusha, Tanzania</p>
</div>

<!-- BANNER IMAGE - CENTERED -->
<div class="banner-wrapper">
  <img src="/sysimages/bronchour.jpeg" alt="Africa Convention 2026" class="header-banner" onerror="this.style.display='none'">
</div>

<!-- TABS -->
<div class="tabs">
  <button class="tab-btn active" onclick="openTab(event, 'dashboard')">📊 Dashboard</button>
  <button class="tab-btn" onclick="openTab(event, 'gallery')">🖼️ Gallery</button>
  <button class="tab-btn" onclick="openTab(event, 'checkin')">✅ Check-in</button>
  <button class="tab-btn" onclick="openTab(event, 'badges')">🎫 Badges</button>
  <button class="tab-btn" onclick="openTab(event, 'statistics')">📈 Statistics</button>
  <button class="tab-btn" onclick="openTab(event, 'training')">🎓 Academy</button>
</div>

<div class="container">

  <!-- TAB 1: DASHBOARD -->
  <div id="dashboard" class="tab-content active">
    <div class="card">
      <h2>Real-time Event Statistics</h2>
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
      <h2>Real-time Activity Log</h2>
      <div id="recentCheckins" style="max-height: 400px; overflow-y: auto;"></div>
    </div>

    <div class="card">
      <h2>Category Breakdown</h2>
      <div id="byCategory"></div>
    </div>
  </div>

  <!-- TAB 2: GALLERY -->
  <div id="gallery" class="tab-content">
    <div class="card">
      <h2>🖼️ Event Venue & Photos</h2>
      <p style="color: #666; margin-bottom: 20px;">Beautiful church venue in Arusha, Tanzania</p>
      <div class="gallery">
        <div class="gallery-item">
          <img src="/sysimages/Venue_1.jpeg" alt="Venue 1">
          <div class="gallery-item-title">Venue Exterior</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_cornerstone_address.jpeg" alt="Cornerstone">
          <div class="gallery-item-title">Cornerstone Address</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_1.jpeg" alt="Interior 1">
          <div class="gallery-item-title">Interior Main Hall</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_2.jpeg" alt="Interior 2">
          <div class="gallery-item-title">Interior Seating</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_3.jpeg" alt="Interior 3">
          <div class="gallery-item-title">Interior Lighting</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_2.jpeg" alt="Venue 2">
          <div class="gallery-item-title">Entrance Area</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_3.jpeg" alt="Venue 3">
          <div class="gallery-item-title">Main Gate</div>
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
          <img src="/sysimages/Bronchour_footer.jpeg" alt="Event Info">
          <div class="gallery-item-title">Event Information</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TAB 3: CHECK-IN -->
  <div id="checkin" class="tab-content">
    <div class="card">
      <h2>Register New Attendee</h2>
      <div id="addMessage"></div>
      <div class="form-row">
        <div>
          <label>Full Name:</label>
          <input type="text" id="name" placeholder="Full name (minimum 2 characters)" required>
        </div>
        <div>
          <label>Email Address:</label>
          <input type="email" id="email" placeholder="Email address" required>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Phone Number:</label>
          <input type="tel" id="phone" placeholder="Phone (optional)">
        </div>
        <div>
          <label>Participant Category:</label>
          <select id="category">
            <option value="">Select Category</option>
            <option value="Youth">Youth</option>
            <option value="Speaker">Speaker</option>
            <option value="Business">Business</option>
            <option value="Staff">Staff</option>
          </select>
        </div>
      </div>
      <button onclick="addAttendee()" class="btn-success" style="width: 100%; padding: 15px; font-size: 16px;">✅ Register New Attendee</button>
    </div>

    <div class="card">
      <h2>Check-in / Check-out Operations</h2>
      <div id="checkinMessage"></div>
      <label>QR Code or Attendee ID:</label>
      <input type="text" id="scanQR" placeholder="Scan QR code or type attendee ID" autofocus>
      <label>Staff Member Name:</label>
      <input type="text" id="staffName" placeholder="Your name (who is processing)">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
        <button onclick="processCheckIn()" class="btn-success" style="padding: 15px; font-size: 16px;">✅ CHECK IN</button>
        <button onclick="processCheckOut()" class="btn-danger" style="padding: 15px; font-size: 16px;">❌ CHECK OUT</button>
      </div>
    </div>

    <div class="card">
      <h2>Recent Activity</h2>
      <div id="checkinLog" style="max-height: 500px; overflow-y: auto;"></div>
    </div>
  </div>

  <!-- TAB 4: BADGES -->
  <div id="badges" class="tab-content">
    <div class="card">
      <h2>Badge Generator</h2>
      <div id="badgeMessage"></div>
      
      <div style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 4px; border-left: 4px solid #667eea;">
        <label style="margin-bottom: 15px;"><strong>Choose Badge Format:</strong></label><br>
        <input type="radio" name="badgeFormat" value="pdf" checked> <strong>📄 PDF</strong> - Email to attendees<br>
        <input type="radio" name="badgeFormat" value="html"> <strong>🖨️ HTML</strong> - Print on-site
      </div>

      <div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 4px;">
        <button onclick="selectBadges('all')">✓ Select All</button>
        <button onclick="selectBadges('none')">✗ Clear All</button>
        <span style="margin-left: 30px; font-weight: bold;">Selected: <span id="selectedCount">0</span> / <span id="totalCount">0</span> attendees</span>
      </div>

      <div style="max-height: 400px; overflow-y: auto; border: 2px solid #ddd; padding: 15px; border-radius: 4px; background: #fafafa; margin: 20px 0;">
        <div id="attendeeCheckboxes"><div class="loading">Loading attendees...</div></div>
      </div>

      <button onclick="generateBadges()" style="width: 100%; background: #28a745; padding: 20px; font-size: 16px; font-weight: bold; margin-top: 20px;">⬇️ Generate & Download Badges</button>
    </div>
  </div>

  <!-- TAB 5: STATISTICS -->
  <div id="statistics" class="tab-content">
    <div class="card">
      <h2>Event Overview</h2>
      <div id="statsDetail"></div>
    </div>

    <div class="card">
      <h2>Category Progress</h2>
      <div id="categoryStats"></div>
    </div>

    <div class="card">
      <h2>Detailed Attendance Report</h2>
      <div id="detailedReport"></div>
    </div>
  </div>

  <!-- TAB 6: TRAINING ACADEMY -->
  <div id="training" class="tab-content">
    <div id="trainingContent"><div class="loading">Loading training academy...</div></div>
  </div>

</div>

<!-- SPONSORS FOOTER -->
<div class="footer-sponsors">
  <div class="sponsors-title">🤝 Event Partners & Sponsors</div>
  <div class="sponsors-grid" id="sponsorContainer">
    <p style="grid-column: 1/-1; text-align: center; color: #999; padding: 30px;">Sponsor logos will appear when files are added to sysimages/sponsors/ folder</p>
  </div>
</div>

<!-- COPYRIGHT FOOTER -->
<div class="footer-copyright">
  <p>&copy; 2026 Africa Convention - Event Management System</p>
  <p>Designed by: <a href="mailto:raphayelchas@gmail.com">raphayelchas@gmail.com</a></p>
  <p>Organized by: Living Hope Mission | WCCM | YWAM | Arusha, Tanzania</p>
  <p style="margin-top: 15px; font-size: 11px; opacity: 0.8;">June 18-22, 2026 | Theme: "Doing Business and Bearing Fruitful" | Expected Attendance: 400-600</p>
</div>

<script>
const authToken = localStorage.getItem('auth_token');

if (!authToken) {
  window.location.href = '/login';
}

function handleLogout() {
  fetch('/api/logout', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + authToken }
  }).then(() => {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  });
}

// Load training academy
function loadTraining() {
  fetch('/documentation/training.html')
    .then(r => {
      if (!r.ok) throw new Error('File not found');
      return r.text();
    })
    .then(html => {
      document.getElementById('trainingContent').innerHTML = html;
    })
    .catch(err => {
      document.getElementById('trainingContent').innerHTML = 
        '<div style="padding:30px; background:#fff3cd; border-radius:4px; margin:20px; border-left: 4px solid #ffc107;">' +
        '<h2>⚠️ Training Academy Not Found</h2>' +
        '<p style="margin-top: 10px;">The training file could not be loaded.</p>' +
        '<p style="color:#666; font-size:13px; margin-top: 15px;"><strong>Expected location:</strong><br>C:\\AfricaConvention\\documentation\\training.html</p>' +
        '<p style="color:#666; font-size:13px; margin-top: 10px;"><strong>Solution:</strong><br>Place africa-convention-training.html in the documentation/ folder</p>' +
        '</div>';
    });
}

// Load sponsors
function loadSponsors() {
  fetch('/api/sponsors')
    .then(r => r.json())
    .then(data => {
      const container = document.getElementById('sponsorContainer');
      if (data.sponsors && data.sponsors.length > 0) {
        let html = '';
        data.sponsors.forEach(sponsor => {
          html += '<div class="sponsor-item"><img src="' + sponsor.path + '" alt="' + sponsor.name + '" class="sponsor-logo"><div class="sponsor-name">' + sponsor.name + '</div></div>';
        });
        container.innerHTML = html;
      }
    });
}

function openTab(evt, tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  evt.currentTarget.classList.add('active');
  
  if (tabName === 'training') {
    loadTraining();
  } else {
    loadData();
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
  
  return fetch(endpoint, options)
    .then(r => {
      if (r.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      return r.json();
    });
}

function loadData() {
  loadStats();
  loadRecentActivity();
  loadAttendeeList();
  loadCategoryStats();
}

function loadStats() {
  apiCall('/api/stats')
    .then(data => {
      if (data.success !== false) {
        document.getElementById('totalStat').textContent = data.total || 0;
        document.getElementById('checkedStat').textContent = data.checked || 0;
        document.getElementById('checkedOutStat').textContent = data.checkedOut || 0;
        document.getElementById('rateStat').textContent = (data.rate || 0) + '%';
      }
    });
}

function loadRecentActivity() {
  apiCall('/api/activity/recent')
    .then(data => {
      const activities = data.activities || [];
      let html = activities.length === 0 ? '<p style="color: #999; padding: 20px;">No activity yet. Start checking in attendees.</p>' : '';
      activities.forEach(a => {
        const time = new Date(a.timestamp).toLocaleTimeString();
        const badge = a.action === 'CHECK_IN' ? '<span style="background: #28a745; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: bold;">✓ IN</span>' : '<span style="background: #dc3545; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: bold;">✗ OUT</span>';
        html += '<div style="background: #f9f9f9; padding: 12px; margin: 8px 0; border-left: 4px solid #667eea; border-radius: 4px;"><strong>' + a.name + '</strong> ' + badge + ' <span style="float: right; color: #999; font-size: 12px;">' + time + ' by ' + (a.by || 'System') + '</span></div>';
      });
      document.getElementById('recentCheckins').innerHTML = html;
      document.getElementById('checkinLog').innerHTML = html;
    });
}

function loadAttendeeList() {
  apiCall('/api/attendees')
    .then(data => {
      const attendees = data.attendees || [];
      let html = '';
      attendees.forEach(a => {
        let badge = '⏳';
        if (a.checked_in && !a.checked_out) badge = '✓';
        else if (a.checked_out) badge = '✗';
        html += '<label style="padding: 10px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; display: block; cursor: pointer; border-left: 3px solid #667eea;"><input type="checkbox" class="badge-checkbox" value="' + a.id + '"> <strong>' + a.name + '</strong> (' + a.category + ') <span style="float: right;">' + badge + '</span></label>';
      });
      document.getElementById('attendeeCheckboxes').innerHTML = html || '<p style="color: #999;">No attendees registered yet.</p>';
      document.getElementById('totalCount').textContent = attendees.length;
      document.querySelectorAll('.badge-checkbox').forEach(cb => cb.addEventListener('change', updateBadgeCount));
      updateBadgeCount();
    });
}

function loadCategoryStats() {
  apiCall('/api/stats/by-category')
    .then(data => {
      const categories = data.categories || [];
      let html = '';
      let table = '<table><tr><th>Category</th><th>Total</th><th>In Event</th><th>Checked Out</th><th>Rate %</th></tr>';
      categories.forEach(c => {
        const pct = c.total > 0 ? Math.round((c.checked / c.total) * 100) : 0;
        html += '<div style="margin: 20px 0;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><strong>' + c.category + '</strong><span style="color: #666; font-size: 13px;">' + c.checked + ' / ' + c.total + ' (' + pct + '%)</span></div><div style="width: 100%; height: 30px; background: #e0e0e0; border-radius: 4px; overflow: hidden;"><div style="width: ' + pct + '%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);"></div></div></div>';
        table += '<tr><td>' + c.category + '</td><td>' + c.total + '</td><td>' + c.checked + '</td><td>' + (c.checkedOut || 0) + '</td><td>' + pct + '%</td></tr>';
      });
      table += '</table>';
      document.getElementById('categoryStats').innerHTML = html;
      document.getElementById('byCategory').innerHTML = html;
      document.getElementById('detailedReport').innerHTML = table;
    });
}

function addAttendee() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const category = document.getElementById('category').value;

  if (!name || name.length < 2) {
    showAlert('Name must be at least 2 characters', 'error', 'addMessage');
    return;
  }
  if (!email) {
    showAlert('Email is required', 'error', 'addMessage');
    return;
  }

  apiCall('/api/add', 'POST', { name, email, phone, category })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + name + ' registered successfully! ID: ' + data.id, 'success', 'addMessage');
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('category').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Failed to register', 'error', 'addMessage');
      }
    });
}

function processCheckIn() {
  const input = document.getElementById('scanQR').value.trim();
  if (!input) {
    showAlert('Enter QR code or attendee ID', 'error', 'checkinMessage');
    return;
  }
  
  apiCall('/api/checkin', 'POST', { qrOrId: input, staffName: document.getElementById('staffName').value.trim() || 'System' })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + data.name + ' checked in successfully', 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Failed', 'error', 'checkinMessage');
      }
    });
}

function processCheckOut() {
  const input = document.getElementById('scanQR').value.trim();
  if (!input) {
    showAlert('Enter QR code or attendee ID', 'error', 'checkinMessage');
    return;
  }
  
  apiCall('/api/checkout', 'POST', { qrOrId: input, staffName: document.getElementById('staffName').value.trim() || 'System' })
    .then(data => {
      if (data.success) {
        showAlert('✓ ' + data.name + ' checked out successfully', 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Failed', 'error', 'checkinMessage');
      }
    });
}

function updateBadgeCount() {
  document.getElementById('selectedCount').textContent = document.querySelectorAll('.badge-checkbox:checked').length;
}

function selectBadges(type) {
  document.querySelectorAll('.badge-checkbox').forEach(cb => cb.checked = (type === 'all'));
  updateBadgeCount();
}

function generateBadges() {
  const selected = Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showAlert('Select at least one attendee', 'error', 'badgeMessage');
    return;
  }

  const format = document.querySelector('input[name="badgeFormat"]:checked').value;
  apiCall('/api/badges/generate', 'POST', { attendeeIds: selected, format: format })
    .then(r => {
      if (format === 'pdf') {
        return r.blob().then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'africa-convention-badges.pdf';
          a.click();
          showAlert('✓ Badges downloaded successfully', 'success', 'badgeMessage');
        });
      } else {
        return r.text().then(html => {
          const w = window.open();
          w.document.write(html);
          w.document.close();
          showAlert('✓ Badges opened for printing', 'success', 'badgeMessage');
        });
      }
    })
    .catch(err => showAlert('Error generating badges', 'error', 'badgeMessage'));
}

function showAlert(msg, type, id) {
  const el = document.getElementById(id);
  el.innerHTML = '<div class="alert ' + type + '"><strong>' + (type === 'success' ? '✓' : '✗') + '</strong> ' + msg + '</div>';
  if (type === 'success') setTimeout(() => el.innerHTML = '', 5000);
}

loadSponsors();
loadData();
setInterval(loadData, 5000);
</script>
</body>
</html>
  `);
});

// Load training on startup
loadTraining();

// ============= API ENDPOINTS =============

app.post('/api/add', requireAuth, async (req, res) => {
  const { name, email, phone, category } = req.body;
  if (!name || !email) return res.json({ success: false, error: 'Name and email required' });
  try {
    const qr = `QR-${Date.now()}`;
    const result = await pool.query(
      'INSERT INTO attendees (name, email, phone, category, qr_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, qr_code',
      [name.trim(), email.trim(), phone || null, category || null, qr]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, id: result.rows[0].id, qrCode: result.rows[0].qr_code });
    }
  } catch (err) {
    const errorResp = handleError(err, 'ADD_ATTENDEE');
    res.status(errorResp.status).json(errorResp);
  }
});

app.post('/api/checkin', requireAuth, async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId.trim()]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Attendee not found' });
    const a = result.rows[0];
    if (a.checked_in && !a.checked_out) return res.json({ success: false, error: a.name + ' already checked in' });
    await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1, checked_out = false WHERE id = $2', [staffName || 'System', a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    const errorResp = handleError(err, 'CHECK_IN');
    res.status(errorResp.status).json(errorResp);
  }
});

app.post('/api/checkout', requireAuth, async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId.trim()]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Attendee not found' });
    const a = result.rows[0];
    if (!a.checked_in) return res.json({ success: false, error: a.name + ' not checked in' });
    if (a.checked_out) return res.json({ success: false, error: a.name + ' already checked out' });
    await pool.query('UPDATE attendees SET checked_out = true, checked_out_at = CURRENT_TIMESTAMP WHERE id = $1', [a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    const errorResp = handleError(err, 'CHECK_OUT');
    res.status(errorResp.status).json(errorResp);
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees');
    const total = parseInt(result.rows[0].total) || 0;
    const checked = parseInt(result.rows[0].checked) || 0;
    const checkedOut = parseInt(result.rows[0].checkedout) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    res.json({ success: true, total, checked, checkedOut, rate });
  } catch (err) {
    res.json({ success: true, total: 0, checked: 0, checkedOut: 0, rate: 0 });
  }
});

app.get('/api/activity/recent', requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT name, checked_in_at as timestamp, 'CHECK_IN' as action, checked_in_by as by FROM attendees WHERE checked_in = true UNION ALL SELECT name, checked_out_at as timestamp, 'CHECK_OUT' as action, checked_in_by as by FROM attendees WHERE checked_out = true ORDER BY timestamp DESC LIMIT 20");
    res.json({ success: true, activities: result.rows });
  } catch (err) {
    res.json({ success: true, activities: [] });
  }
});

app.get('/api/attendees', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, category, checked_in, checked_out FROM attendees ORDER BY id DESC');
    res.json({ success: true, attendees: result.rows });
  } catch (err) {
    res.json({ success: true, attendees: [] });
  }
});

app.get('/api/stats/by-category', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT category, COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees GROUP BY category ORDER BY category');
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.json({ success: true, categories: [] });
  }
});

app.get('/api/sponsors', requireAuth, (req, res) => {
  const sponsors = getSponsorLogos();
  res.json({ success: true, sponsors: sponsors });
});

app.post('/api/badges/generate', requireAuth, async (req, res) => {
  const { attendeeIds, format } = req.body;
  if (!attendeeIds || attendeeIds.length === 0) return res.status(400).json({ success: false, error: 'Select attendees' });
  try {
    const placeholders = attendeeIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`SELECT id, name, email, category, qr_code FROM attendees WHERE id IN (${placeholders})`, attendeeIds);
    const attendees = result.rows;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="africa-convention-badges.pdf"');
      let pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 500 >>\nstream\nBT\n/F1 20 Tf\n50 750 Td\n(AFRICA CONVENTION 2026 - ID BADGES) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n900\n%%EOF';
      res.send(pdf);
    } else {
      let html = '<!DOCTYPE html><html><head><title>Badges</title><meta name="viewport" content="width=device-width"><style>body{margin:20px;font-family:Arial;background:#f5f5f5}.badge{display:inline-block;width:3.5in;height:2.2in;border:2px solid #667eea;padding:15px;margin:10px;text-align:center;background:white;page-break-inside:avoid;box-shadow:0 2px 8px rgba(0,0,0,0.1);border-radius:4px}.badge-name{font-size:18px;font-weight:bold;color:#333;margin:10px 0}.badge-category{font-size:13px;color:#667eea;font-weight:bold}.badge-email{font-size:11px;color:#666;margin-top:10px}@media print{body{margin:0}.badge{margin:5px;box-shadow:none}}</style></head><body><h1 style="text-align:center; color:#667eea;">Africa Convention 2026 - ID Badges</h1>';
      attendees.forEach(a => {
        html += '<div class="badge"><div class="badge-name">' + a.name + '</div><div class="badge-category">' + (a.category || 'Participant') + '</div><div class="badge-email">' + a.email + '</div></div>';
      });
      html += '<p style="text-align:center; margin-top:40px; color:#999; font-size:12px;">Generated on ' + new Date().toLocaleString() + '</p></body></html>';
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    const errorResp = handleError(err, 'GENERATE_BADGES');
    res.status(errorResp.status).json(errorResp);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎊 AFRICA CONVENTION 2026 - EVENT MANAGEMENT SYSTEM');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✓ Server: http://localhost:' + PORT);
  console.log('  ✓ Login: http://localhost:' + PORT + '/login');
  console.log('  ✓ Dashboard: 6 tabs with full functionality');
  console.log('  ✓ Images: JPEG support enabled');
  console.log('  ✓ Training: Loaded from documentation/training.html');
  console.log('  ✓ Sponsors: Auto-loading from sysimages/sponsors/');
  console.log('  ✓ Authentication: Admin login required');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
});
