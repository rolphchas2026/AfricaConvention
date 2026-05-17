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
app.use(express.static('sysimages'));
app.use(express.static('documentation'));

const pool = new Pool({
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  database: process.env.DB_NAME || 'africa_convention'
});

// Load training
let trainingContent = '';
try {
  trainingContent = fs.readFileSync('./documentation/training.html', 'utf8');
} catch (err) {
  trainingContent = '<h1>Training Academy</h1>';
}

// Get sponsors
function getSponsorLogos() {
  const sponsorDir = './sysimages/sponsors';
  let sponsors = [];
  try {
    if (fs.existsSync(sponsorDir)) {
      const files = fs.readdirSync(sponsorDir);
      sponsors = files.filter(f => f.startsWith('sponsor-')).map(f => ({
        name: f.replace('sponsor-', '').replace(/\.[^/.]+$/, ""),
        path: `/sponsors/${f}`
      }));
    }
  } catch (err) {
    console.warn('Sponsors not loaded:', err.message);
  }
  return sponsors;
}

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

// MAIN DASHBOARD
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention 2026 - Event Management</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    
    .header-top { background: white; padding: 10px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
    .header-logos { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
    .header-logo { max-height: 50px; object-fit: contain; }
    
    .header-main { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; }
    .header-main h1 { font-size: 28px; margin-bottom: 10px; }
    .header-main p { font-size: 14px; opacity: 0.9; }
    
    .header-banner { width: 100%; margin: 15px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header-banner img { width: 100%; height: auto; display: block; }
    
    .tabs { display: flex; background: white; border-bottom: 2px solid #667eea; overflow-x: auto; flex-wrap: wrap; }
    .tab-btn { padding: 15px 25px; cursor: pointer; background: #f5f5f5; border: none; font-size: 14px; font-weight: 500; color: #333; transition: 0.3s; white-space: nowrap; flex: 1; min-width: 120px; }
    .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
    .tab-btn:hover { background: #efefef; }
    
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card-image { width: 100%; border-radius: 8px; margin-bottom: 15px; max-height: 400px; object-fit: cover; }
    
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    
    input, select { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: 10px; margin-top: 10px; }
    button:hover { background: #764ba2; }
    .btn-success { background: #28a745; }
    .btn-danger { background: #dc3545; }
    
    .alert { padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid; }
    .alert.success { background: #d4edda; color: #155724; border-color: #28a745; }
    .alert.error { background: #f8d7da; color: #721c24; border-color: #dc3545; }
    
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
    .gallery-item { border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: 0.3s; }
    .gallery-item:hover { transform: scale(1.02); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .gallery-item img { width: 100%; height: 200px; object-fit: cover; }
    .gallery-item-title { padding: 10px; background: white; text-align: center; font-size: 12px; color: #666; }
    
    .footer-sponsors { background: #f9f9f9; padding: 30px 20px; margin-top: 40px; border-top: 2px solid #667eea; }
    .sponsors-title { text-align: center; font-size: 20px; font-weight: bold; color: #667eea; margin-bottom: 20px; }
    .sponsors-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px; margin: 20px 0; align-items: center; justify-items: center; }
    .sponsor-item { text-align: center; }
    .sponsor-logo { max-height: 60px; max-width: 120px; object-fit: contain; }
    .sponsor-name { font-size: 11px; color: #666; margin-top: 8px; font-weight: 500; }
    
    .footer-copyright { text-align: center; padding: 20px; background: #333; color: white; font-size: 12px; }
    .footer-copyright a { color: #667eea; text-decoration: none; }
    .footer-copyright a:hover { text-decoration: underline; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    label { display: block; margin-bottom: 5px; color: #333; font-weight: 500; }
    
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: bold; }
    tr:hover { background: #f9f9f9; }
  </style>
</head>
<body>

<!-- HEADER WITH LOGOS -->
<div class="header-top">
  <div class="header-logos">
    <img src="/wccm-logo.png" class="header-logo" alt="WCCM" style="display:none;">
    <img src="/livinghope-logo.png" class="header-logo" alt="Living Hope" style="display:none;">
  </div>
  <div class="header-logos">
    <img src="/ywam-logo.png" class="header-logo" alt="YWAM" style="display:none;">
  </div>
</div>

<!-- MAIN HEADER -->
<div class="header-main">
  <h1>🎊 Africa Convention 2026</h1>
  <p>Event Management System | Theme: "Doing Business and Bearing Fruitful" | Arusha, Tanzania</p>
  <p style="font-size: 12px; margin-top: 10px;">June 18-22, 2026 | Living Hope Mission / WCCM / YWAM</p>
</div>

<!-- BANNER IMAGE -->
<div class="container">
  <div class="header-banner">
    <img src="/bronchour.jpeg" alt="Africa Convention 2026" style="max-height: 300px; object-fit: cover; width: 100%;">
  </div>
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
    <p>Beautiful church venue in Arusha, Tanzania - Perfect for Africa Convention 2026</p>
    <div class="gallery">
      <div class="gallery-item">
        <img src="/Venue_1.jpeg" alt="Venue Exterior">
        <div class="gallery-item-title">Venue Exterior</div>
      </div>
      <div class="gallery-item">
        <img src="/Venue_cornerstone_address.jpeg" alt="Cornerstone Address">
        <div class="gallery-item-title">Cornerstone Address</div>
      </div>
      <div class="gallery-item">
        <img src="/inside_church_bg_1.jpeg" alt="Interior View 1">
        <div class="gallery-item-title">Interior Main Hall</div>
      </div>
      <div class="gallery-item">
        <img src="/inside_church_bg_2.jpeg" alt="Interior View 2">
        <div class="gallery-item-title">Interior Seating</div>
      </div>
      <div class="gallery-item">
        <img src="/inside_church_bg_3.jpeg" alt="Interior View 3">
        <div class="gallery-item-title">Interior Lighting</div>
      </div>
      <div class="gallery-item">
        <img src="/Venue_2.jpeg" alt="Venue Details">
        <div class="gallery-item-title">Entrance Area</div>
      </div>
      <div class="gallery-item">
        <img src="/Venue_3.jpeg" alt="Venue Gate">
        <div class="gallery-item-title">Main Gate</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>📋 Event Brochures</h2>
    <div class="gallery">
      <div class="gallery-item">
        <img src="/youth_Summit_bronchour.jpeg" alt="Youth Summit">
        <div class="gallery-item-title">Youth Summit</div>
      </div>
      <div class="gallery-item">
        <img src="/Bronchour_footer.jpeg" alt="Event Details">
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
        <input type="text" id="name" placeholder="Name">
      </div>
      <div>
        <label>Email:</label>
        <input type="email" id="email" placeholder="Email">
      </div>
    </div>
    <div class="form-row">
      <div>
        <label>Phone:</label>
        <input type="tel" id="phone" placeholder="Phone">
      </div>
      <div>
        <label>Category:</label>
        <select id="category">
          <option value="">Select</option>
          <option value="Youth">Youth</option>
          <option value="Speaker">Speaker</option>
          <option value="Business">Business</option>
          <option value="Staff">Staff</option>
        </select>
      </div>
    </div>
    <button onclick="addAttendee()" style="width: 100%; background: #28a745;">✅ Register</button>
  </div>

  <div class="card">
    <h2>Check-in/Check-out</h2>
    <div id="checkinMessage"></div>
    <label>QR Code or ID:</label>
    <input type="text" id="scanQR" placeholder="Scan or type" autofocus>
    <label>Staff Name:</label>
    <input type="text" id="staffName" placeholder="Your name">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <button onclick="processCheckIn()" style="background: #28a745;">✅ CHECK IN</button>
      <button onclick="processCheckOut()" style="background: #dc3545;">❌ CHECK OUT</button>
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
    
    <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px;">
      <label><strong>Format:</strong></label><br>
      <input type="radio" name="badgeFormat" value="pdf" checked> 📄 PDF<br>
      <input type="radio" name="badgeFormat" value="html"> 🖨️ HTML
    </div>

    <div style="margin: 15px 0;">
      <button onclick="selectBadges('all')">✓ All</button>
      <button onclick="selectBadges('none')">✗ Clear</button>
      <span style="margin-left: 20px;"><strong>Selected: <span id="selectedCount">0</span> / <span id="totalCount">0</span></strong></span>
    </div>

    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
      <div id="attendeeCheckboxes">Loading...</div>
    </div>

    <button onclick="generateBadges()" style="width: 100%; background: #28a745; padding: 20px; margin-top: 20px; font-weight: bold;">⬇️ Generate</button>
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
    <h2>Detailed Report</h2>
    <div id="detailedReport"></div>
  </div>
</div>

<!-- TAB 6: TRAINING ACADEMY -->
<div id="training" class="tab-content">
  <div id="trainingContent"></div>
</div>

</div>

<!-- SPONSORS FOOTER -->
<div class="footer-sponsors">
  <div class="sponsors-title">🤝 Event Partners & Sponsors</div>
  <div class="sponsors-grid" id="sponsorContainer">
    <p style="grid-column: 1/-1; text-align: center; color: #999;">Sponsor logos will appear here</p>
  </div>
</div>

<!-- COPYRIGHT FOOTER -->
<div class="footer-copyright">
  <p>&copy; 2026 Africa Convention - Event Management System</p>
  <p>Designed by: <a href="mailto:raphayelchas@gmail.com">raphayelchas@gmail.com</a></p>
  <p>Organized by: Living Hope Mission | WCCM | YWAM | Arusha, Tanzania</p>
  <p style="margin-top: 10px; font-size: 11px;">June 18-22, 2026 | Theme: "Doing Business and Bearing Fruitful"</p>
</div>

<script>
document.getElementById('currentDate') = new Date().toLocaleDateString();

// Load training
fetch('/training.html')
  .then(r => r.text())
  .then(html => document.getElementById('trainingContent').innerHTML = html)
  .catch(e => console.error('Training load failed:', e));

// Load sponsors
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

function openTab(evt, tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  evt.currentTarget.classList.add('active');
  loadData();
}

function loadData() {
  loadStats();
  loadRecentActivity();
  loadAttendeeList();
  loadCategoryStats();
}

function loadStats() {
  fetch('/api/stats')
    .then(r => r.json())
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
  fetch('/api/activity/recent')
    .then(r => r.json())
    .then(data => {
      const activities = data.activities || [];
      let html = activities.length === 0 ? '<p style="color: #999;">No activity</p>' : '';
      activities.forEach(a => {
        const time = new Date(a.timestamp).toLocaleTimeString();
        const badge = a.action === 'CHECK_IN' ? '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">✓ IN</span>' : '<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">✗ OUT</span>';
        html += '<div style="background: #f9f9f9; padding: 10px; margin: 8px 0; border-left: 4px solid #667eea;"><strong>' + a.name + '</strong> ' + badge + ' ' + time + ' by ' + (a.by || 'System') + '</div>';
      });
      document.getElementById('recentCheckins').innerHTML = html;
      document.getElementById('checkinLog').innerHTML = html;
    });
}

function loadAttendeeList() {
  fetch('/api/attendees')
    .then(r => r.json())
    .then(data => {
      const attendees = data.attendees || [];
      let html = '';
      attendees.forEach(a => {
        let badge = '⏳';
        if (a.checked_in && !a.checked_out) badge = '✓';
        else if (a.checked_out) badge = '✗';
        html += '<label style="padding: 8px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; display: block;"><input type="checkbox" class="badge-checkbox" value="' + a.id + '"> <strong>' + a.name + '</strong> (' + a.category + ') ' + badge + '</label>';
      });
      document.getElementById('attendeeCheckboxes').innerHTML = html;
      document.getElementById('totalCount').textContent = attendees.length;
      document.querySelectorAll('.badge-checkbox').forEach(cb => cb.addEventListener('change', updateBadgeCount));
      updateBadgeCount();
    });
}

function loadCategoryStats() {
  fetch('/api/stats/by-category')
    .then(r => r.json())
    .then(data => {
      const categories = data.categories || [];
      let html = '';
      let table = '<table><tr><th>Category</th><th>Total</th><th>In</th><th>Out</th><th>Rate</th></tr>';
      categories.forEach(c => {
        const pct = c.total > 0 ? Math.round((c.checked / c.total) * 100) : 0;
        html += '<div style="margin: 15px 0;"><strong>' + c.category + '</strong>: ' + c.checked + ' / ' + c.total + ' (' + pct + '%)<div style="width: 100%; height: 25px; background: #e0e0e0; border-radius: 4px;"><div style="width: ' + pct + '%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius: 4px;"></div></div></div>';
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

  if (!name || !email) {
    showAlert('Name and email required', 'error', 'addMessage');
    return;
  }

  fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, category })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showAlert('✓ Registered! ID: ' + data.id, 'success', 'addMessage');
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
  
  fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrOrId: input, staffName: document.getElementById('staffName').value.trim() || 'System' })
  })
    .then(r => r.json())
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
  
  fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrOrId: input, staffName: document.getElementById('staffName').value.trim() || 'System' })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showAlert('✗ ' + data.name + ' checked out', 'success', 'checkinMessage');
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
  if (selected.length === 0) { showAlert('Select attendees', 'error', 'badgeMessage'); return; }

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
          a.download = 'badges.pdf';
          a.click();
          showAlert('Downloaded', 'success', 'badgeMessage');
        });
      } else {
        return r.text().then(html => { const w = window.open(); w.document.write(html); });
      }
    });
}

function showAlert(msg, type, id) {
  const el = document.getElementById(id);
  el.innerHTML = '<div class="alert ' + type + '"><strong>' + (type === 'success' ? '✓' : '✗') + '</strong> ' + msg + '</div>';
  if (type === 'success') setTimeout(() => el.innerHTML = '', 5000);
}

setInterval(loadData, 5000);
loadData();
</script>
</body>
</html>
  `);
});

// API ENDPOINTS
app.post('/api/add', async (req, res) => {
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

app.post('/api/checkin', async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId.trim()]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Not found' });
    const a = result.rows[0];
    if (a.checked_in && !a.checked_out) return res.json({ success: false, error: a.name + ' already in' });
    await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1, checked_out = false WHERE id = $2', [staffName || 'System', a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    const errorResp = handleError(err, 'CHECK_IN');
    res.status(errorResp.status).json(errorResp);
  }
});

app.post('/api/checkout', async (req, res) => {
  const { qrOrId, staffName } = req.body;
  if (!qrOrId) return res.json({ success: false, error: 'Enter QR or ID' });
  try {
    const query = isNaN(qrOrId) ? 'SELECT * FROM attendees WHERE qr_code = $1' : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId.trim()]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Not found' });
    const a = result.rows[0];
    if (!a.checked_in) return res.json({ success: false, error: a.name + ' not checked in' });
    if (a.checked_out) return res.json({ success: false, error: a.name + ' already out' });
    await pool.query('UPDATE attendees SET checked_out = true, checked_out_at = CURRENT_TIMESTAMP WHERE id = $1', [a.id]);
    res.json({ success: true, name: a.name });
  } catch (err) {
    const errorResp = handleError(err, 'CHECK_OUT');
    res.status(errorResp.status).json(errorResp);
  }
});

app.get('/api/stats', async (req, res) => {
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

app.get('/api/activity/recent', async (req, res) => {
  try {
    const result = await pool.query("SELECT name, checked_in_at as timestamp, 'CHECK_IN' as action, checked_in_by as by FROM attendees WHERE checked_in = true UNION ALL SELECT name, checked_out_at as timestamp, 'CHECK_OUT' as action, checked_in_by as by FROM attendees WHERE checked_out = true ORDER BY timestamp DESC LIMIT 20");
    res.json({ success: true, activities: result.rows });
  } catch (err) {
    res.json({ success: true, activities: [] });
  }
});

app.get('/api/attendees', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, category, checked_in, checked_out FROM attendees ORDER BY id DESC');
    res.json({ success: true, attendees: result.rows });
  } catch (err) {
    res.json({ success: true, attendees: [] });
  }
});

app.get('/api/stats/by-category', async (req, res) => {
  try {
    const result = await pool.query('SELECT category, COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees GROUP BY category ORDER BY category');
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.json({ success: true, categories: [] });
  }
});

app.get('/api/sponsors', (req, res) => {
  const sponsors = getSponsorLogos();
  res.json({ success: true, sponsors: sponsors });
});

app.get('/api/training', (req, res) => {
  res.header('Content-Type', 'text/html');
  res.send(trainingContent);
});

app.post('/api/badges/generate', async (req, res) => {
  const { attendeeIds, format } = req.body;
  if (!attendeeIds || attendeeIds.length === 0) return res.status(400).json({ success: false, error: 'Select attendees' });
  try {
    const placeholders = attendeeIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`SELECT id, name, email, category, qr_code FROM attendees WHERE id IN (${placeholders})`, attendeeIds);
    const attendees = result.rows;
    const sponsors = getSponsorLogos();

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="badges.pdf"');
      let pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 300 >>\nstream\nBT\n/F1 20 Tf\n50 750 Td\n(AFRICA CONVENTION 2026 - ID BADGES) Tj\n0 -30 Td\n/F1 12 Tf\n(Total: ' + attendees.length + ') Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n650\n%%EOF';
      res.send(pdf);
    } else {
      let html = '<html><head><title>Badges</title><style>body{margin:20px}.badge{display:inline-block;width:3.5in;border:2px solid #667eea;padding:15px;margin:10px;text-align:center}.badge-name{font-size:16px;font-weight:bold}</style></head><body>';
      attendees.forEach(a => {
        html += '<div class="badge"><div class="badge-name">' + a.name + '</div><div style="font-size:12px">' + a.category + '</div><div style="font-size:10px">' + a.email + '</div></div>';
      });
      html += '</body></html>';
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
  console.log('  ✓ Features: Dashboard | Gallery | Check-in | Badges');
  console.log('  ✓ Images: Fully integrated');
  console.log('  ✓ Sponsors: Auto-loading from /sysimages/sponsors/');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
});
