const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Determine base paths
const baseDir = __dirname;
const docsDir = path.join(baseDir, 'documentation');
const imagesDir = path.join(baseDir, 'sysimages');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  🔍 AFRICA CONVENTION 2026 - DIAGNOSTIC MODE');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Base Directory: ${baseDir}`);
console.log(`Docs Directory: ${docsDir}`);
console.log(`Images Directory: ${imagesDir}`);

// Check if directories exist
console.log('\n📁 CHECKING DIRECTORIES:');
console.log(`  documentation/ exists: ${fs.existsSync(docsDir)}`);
console.log(`  sysimages/ exists: ${fs.existsSync(imagesDir)}`);

// List files in directories
if (fs.existsSync(docsDir)) {
  const docs = fs.readdirSync(docsDir);
  console.log(`\n📄 FILES IN documentation/ (${docs.length} files):`);
  docs.forEach(f => console.log(`    ✓ ${f}`));
}

if (fs.existsSync(imagesDir)) {
  const images = fs.readdirSync(imagesDir);
  console.log(`\n🖼️  FILES IN sysimages/ (${images.length} files):`);
  images.forEach(f => console.log(`    ✓ ${f}`));
}

console.log('\n═══════════════════════════════════════════════════════════\n');

app.use(cors());
app.use(express.json());

// EXPLICIT STATIC FILE SERVING - THIS IS THE FIX
app.use(express.static(baseDir));
app.use('/documentation', express.static(docsDir));
app.use('/sysimages', express.static(imagesDir));

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

// Load training content
let trainingContent = '';
function loadTraining() {
  const trainingPath = path.join(docsDir, 'training.html');
  try {
    trainingContent = fs.readFileSync(trainingPath, 'utf8');
    console.log(`✓ Training loaded: ${trainingPath}`);
  } catch (err) {
    console.warn(`⚠ Training not found: ${trainingPath}`);
    trainingContent = `
      <div style="padding:30px; background:#fff3cd; border-radius:4px; margin:20px; border-left: 4px solid #ffc107;">
        <h2>⚠️ Training Academy File Not Found</h2>
        <p><strong>Expected location:</strong> ${trainingPath}</p>
        <p><strong>File exists:</strong> ${fs.existsSync(trainingPath) ? 'YES' : 'NO'}</p>
        <p style="margin-top:15px; color:#666;">
          <strong>Solution:</strong><br>
          1. Ensure documentation/ folder exists<br>
          2. Place training.html in documentation/ folder<br>
          3. Restart Docker: docker-compose restart qr-api
        </p>
      </div>
    `;
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

// Check authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.body.token;
  if (!token || !sessions[token]) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.userId = sessions[token].userId;
  req.userName = sessions[token].userName;
  next();
}

// ERROR HANDLER
const handleError = (err, context) => {
  console.error(`[${new Date().toISOString()}] [${context}]`, err);
  if (err.code === '23505') return { success: false, error: 'Duplicate entry', status: 400 };
  if (err.code === 'ECONNREFUSED') return { success: false, error: 'Database unavailable', status: 503 };
  return { success: false, error: 'System error', status: 500 };
};

// ============= DIAGNOSTIC ENDPOINTS =============

// Debug: Show what files are available
app.get('/api/debug/files', requireAuth, (req, res) => {
  const result = {
    baseDir: baseDir,
    directories: {
      documentation: {
        exists: fs.existsSync(docsDir),
        path: docsDir,
        files: fs.existsSync(docsDir) ? fs.readdirSync(docsDir) : []
      },
      sysimages: {
        exists: fs.existsSync(imagesDir),
        path: imagesDir,
        files: fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : []
      }
    }
  };
  res.json(result);
});

// Debug: Test image serving
app.get('/api/debug/test-image/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(imagesDir, filename);
  
  console.log(`Testing: ${filepath}`);
  console.log(`Exists: ${fs.existsSync(filepath)}`);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({
      error: 'File not found',
      tried: filepath,
      exists: false,
      directory_contents: fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : 'Directory not found'
    });
  }
});

// ============= AUTHENTICATION ROUTES =============

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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions[token] = { userId: 'admin', userName: username, loginTime: new Date() };
    res.json({ success: true, token: token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

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
    html, body { width: 100%; height: 100%; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .header-top { 
      background: white; 
      padding: 15px 20px; 
      border-bottom: 1px solid #ddd; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .user-info { font-size: 12px; color: #666; text-align: right; }
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
    .banner-placeholder {
      width: 100%;
      max-width: 600px;
      height: 250px;
      background: #f5f5f5;
      border: 2px dashed #ccc;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 14px;
      text-align: center;
      padding: 20px;
    }
    
    .tabs { 
      display: flex; 
      background: white; 
      border-bottom: 2px solid #667eea; 
      overflow-x: auto;
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
      text-align: center;
    }
    .tab-btn.active { 
      background: white; 
      color: #667eea; 
      border-bottom: 3px solid #667eea; 
    }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; width: 100%; }
    .card { background: white; padding: 25px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card h2 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    
    input, select { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin: 10px 10px 10px 0; }
    button:hover { background: #764ba2; }
    
    .alert { padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid; }
    .alert.success { background: #d4edda; color: #155724; border-color: #28a745; }
    .alert.error { background: #f8d7da; color: #721c24; border-color: #dc3545; }
    
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
    .gallery-item { border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .gallery-item img { width: 100%; height: 200px; object-fit: cover; display: block; }
    .gallery-item-title { padding: 12px; background: white; text-align: center; font-size: 13px; color: #666; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    .footer-sponsors { background: #f9f9f9; padding: 40px 20px; margin-top: 40px; border-top: 2px solid #667eea; text-align: center; }
    .sponsors-title { font-size: 22px; font-weight: bold; color: #667eea; margin-bottom: 30px; }
    .sponsors-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 25px; max-width: 1200px; margin: 20px auto; }
    .sponsor-logo { max-height: 70px; max-width: 130px; object-fit: contain; }
    
    .footer-copyright { text-align: center; padding: 30px 20px; background: #333; color: white; font-size: 12px; }
    .footer-copyright a { color: #667eea; text-decoration: none; }
    
    .loading { text-align: center; padding: 40px 20px; color: #999; }
    .image-debug { background: #fff3cd; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107; }
  </style>
</head>
<body>

<!-- HEADER -->
<div class="header-top">
  <div>
    <img src="/sysimages/wccm-logo.png" style="max-height:50px;" alt="WCCM" onerror="this.style.display='none'">
  </div>
  <div class="user-info">
    <div>✓ Logged in as: admin</div>
    <button class="logout-btn" onclick="handleLogout()">Logout</button>
  </div>
</div>

<!-- MAIN HEADER -->
<div class="header-main">
  <h1>🎊 Africa Convention 2026</h1>
  <p>Event Management System | June 18-22, 2026</p>
</div>

<!-- BANNER -->
<div class="banner-wrapper">
  <img src="/sysimages/bronchour.jpeg" alt="Banner" class="header-banner" onerror="this.parentElement.innerHTML='<div class=\\"banner-placeholder\\">Banner image not found<br><small>Check /sysimages/ folder</small></div>'">
</div>

<!-- TABS -->
<div class="tabs">
  <button class="tab-btn active" onclick="openTab(event, 'dashboard')">📊 Dashboard</button>
  <button class="tab-btn" onclick="openTab(event, 'gallery')">🖼️ Gallery</button>
  <button class="tab-btn" onclick="openTab(event, 'checkin')">✅ Check-in</button>
  <button class="tab-btn" onclick="openTab(event, 'badges')">🎫 Badges</button>
  <button class="tab-btn" onclick="openTab(event, 'statistics')">📈 Stats</button>
  <button class="tab-btn" onclick="openTab(event, 'training')">🎓 Academy</button>
  <button class="tab-btn" onclick="openTab(event, 'debug')">🔧 Debug</button>
</div>

<div class="container">

  <!-- DASHBOARD -->
  <div id="dashboard" class="tab-content active">
    <div class="card">
      <h2>Statistics</h2>
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
          <div class="stat-label">Rate</div>
        </div>
      </div>
    </div>
  </div>

  <!-- GALLERY -->
  <div id="gallery" class="tab-content">
    <div class="card">
      <h2>🖼️ Gallery</h2>
      <div class="gallery">
        <div class="gallery-item">
          <img src="/sysimages/Venue_1.jpeg" alt="Venue 1" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Venue 1</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_2.jpeg" alt="Venue 2" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Venue 2</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_3.jpeg" alt="Venue 3" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Venue 3</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_1.jpeg" alt="Interior 1" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Interior 1</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_2.jpeg" alt="Interior 2" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Interior 2</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/inside_church_bg_3.jpeg" alt="Interior 3" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Interior 3</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Venue_cornerstone_address.jpeg" alt="Cornerstone" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Cornerstone</div>
        </div>
      </div>
      <div class="gallery">
        <div class="gallery-item">
          <img src="/sysimages/youth_Summit_bronchour.jpeg" alt="Youth Summit" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Youth Summit</div>
        </div>
        <div class="gallery-item">
          <img src="/sysimages/Bronchour_footer.jpeg" alt="Footer" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EImage not found%3C/text%3E%3C/svg%3E'">
          <div class="gallery-item-title">Footer</div>
        </div>
      </div>
    </div>
  </div>

  <!-- CHECK-IN -->
  <div id="checkin" class="tab-content">
    <div class="card">
      <h2>Check-in</h2>
      <label>Attendee ID or QR:</label>
      <input type="text" id="scanQR" placeholder="Enter ID or scan QR">
      <button onclick="apiCall('/api/stats', 'GET').then(d => alert(JSON.stringify(d)))">Test API</button>
    </div>
  </div>

  <!-- BADGES -->
  <div id="badges" class="tab-content">
    <div class="card">
      <h2>Badges</h2>
      <p>Badge generation feature</p>
    </div>
  </div>

  <!-- STATISTICS -->
  <div id="statistics" class="tab-content">
    <div class="card">
      <h2>Statistics</h2>
      <p>Statistics feature</p>
    </div>
  </div>

  <!-- TRAINING -->
  <div id="training" class="tab-content">
    <div id="trainingContent"><div class="loading">Loading training...</div></div>
  </div>

  <!-- DEBUG -->
  <div id="debug" class="tab-content">
    <div class="card">
      <h2>🔧 Debug Information</h2>
      <button onclick="loadDebugInfo()">Refresh Debug Info</button>
      <div id="debugInfo" style="margin-top: 20px; background: #f5f5f5; padding: 20px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; font-size: 12px;"></div>
    </div>
  </div>

</div>

<!-- FOOTER -->
<div class="footer-sponsors">
  <div class="sponsors-title">🤝 Sponsors</div>
  <div class="sponsors-grid" id="sponsorContainer">
    <p style="grid-column: 1/-1;">No sponsors yet</p>
  </div>
</div>

<div class="footer-copyright">
  <p>&copy; 2026 Africa Convention</p>
  <p>Designed by: <a href="mailto:raphayelchas@gmail.com">raphayelchas@gmail.com</a></p>
</div>

<script>
const authToken = localStorage.getItem('auth_token');
if (!authToken) { window.location.href = '/login'; }

function handleLogout() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}

function openTab(evt, tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  evt.currentTarget.classList.add('active');
  
  if (tab === 'training') loadTraining();
  else if (tab === 'debug') loadDebugInfo();
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
    .then(r => {
      if (!r.ok) throw new Error('Not found: ' + r.status);
      return r.text();
    })
    .then(html => {
      document.getElementById('trainingContent').innerHTML = html;
    })
    .catch(err => {
      document.getElementById('trainingContent').innerHTML = 
        '<div class="image-debug"><strong>⚠ Training Not Found</strong><br>Expected: /documentation/training.html<br>Error: ' + err.message + '</div>';
    });
}

function loadDebugInfo() {
  apiCall('/api/debug/files')
    .then(data => {
      let html = 'FILES STATUS:\\n\\n';
      html += 'Base Dir: ' + data.baseDir + '\\n\\n';
      
      html += 'DOCUMENTATION/:\\n';
      html += '  Exists: ' + data.directories.documentation.exists + '\\n';
      html += '  Path: ' + data.directories.documentation.path + '\\n';
      html += '  Files: ' + JSON.stringify(data.directories.documentation.files, null, 2) + '\\n\\n';
      
      html += 'SYSIMAGES/:\\n';
      html += '  Exists: ' + data.directories.sysimages.exists + '\\n';
      html += '  Path: ' + data.directories.sysimages.path + '\\n';
      html += '  Files: ' + JSON.stringify(data.directories.sysimages.files, null, 2);
      
      document.getElementById('debugInfo').textContent = html;
    })
    .catch(err => {
      document.getElementById('debugInfo').textContent = 'Error: ' + err.message;
    });
}
</script>

</body>
</html>
  `);
});

// ============= API ENDPOINTS =============

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total FROM attendees');
    res.json({ success: true, total: parseInt(result.rows[0].total) || 0 });
  } catch (err) {
    res.json({ success: true, total: 0 });
  }
});

app.post('/api/add', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.json({ success: false, error: 'Name and email required' });
  try {
    const result = await pool.query(
      'INSERT INTO attendees (name, email, qr_code) VALUES ($1, $2, $3) RETURNING id',
      [name, email, `QR-${Date.now()}`]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    const errorResp = handleError(err, 'ADD_ATTENDEE');
    res.status(errorResp.status).json(errorResp);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n✓ Server started on port ' + PORT);
  console.log('✓ Login: http://localhost:' + PORT + '/login');
  console.log('✓ Dashboard: http://localhost:' + PORT);
  console.log('✓ Debug tab available after login\n');
});
