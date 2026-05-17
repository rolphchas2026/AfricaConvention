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

// ===== COMPREHENSIVE ERROR HANDLER =====
const handleError = (err, context) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${context}] ERROR: ${err.code || 'UNKNOWN'} - ${err.message}`;
  console.error(logEntry);

  // DUPLICATE KEY ERRORS
  if (err.code === '23505') {
    if (err.constraint === 'attendees_email_key') {
      return {
        success: false,
        error: 'This email address is already registered. Please use a different email or contact support if this is an error.',
        type: 'DUPLICATE_EMAIL',
        status: 400
      };
    }
    if (err.constraint === 'attendees_qr_code_key') {
      return {
        success: false,
        error: 'This QR code already exists in the system. This should not happen - please contact system administrator.',
        type: 'DUPLICATE_QR',
        status: 400
      };
    }
    if (err.constraint === 'attendees_ticket_id_key') {
      return {
        success: false,
        error: 'This ticket ID is already registered. Please verify your ticket ID and try again.',
        type: 'DUPLICATE_TICKET',
        status: 400
      };
    }
  }

  // NOT NULL VIOLATIONS
  if (err.code === '23502') {
    return {
      success: false,
      error: 'Missing required information. Please fill in all required fields (Name and Email are mandatory).',
      type: 'MISSING_REQUIRED_FIELD',
      status: 400
    };
  }

  // FOREIGN KEY VIOLATIONS
  if (err.code === '23503') {
    return {
      success: false,
      error: 'Invalid reference data. Please check your input and try again.',
      type: 'INVALID_REFERENCE',
      status: 400
    };
  }

  // CHECK CONSTRAINT VIOLATIONS
  if (err.code === '23514') {
    return {
      success: false,
      error: 'Invalid data format. Please check your input and try again.',
      type: 'INVALID_DATA_FORMAT',
      status: 400
    };
  }

  // UNIQUE VIOLATIONS (generic)
  if (err.code === '23505') {
    return {
      success: false,
      error: 'This record already exists. Please use different values or contact support.',
      type: 'DUPLICATE_RECORD',
      status: 400
    };
  }

  // CONNECTION ERRORS
  if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
    return {
      success: false,
      error: 'Database service is temporarily unavailable. Please try again in a moment.',
      type: 'SERVICE_UNAVAILABLE',
      status: 503
    };
  }

  // TIMEOUT ERRORS
  if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
    return {
      success: false,
      error: 'Request timed out. Please try again.',
      type: 'TIMEOUT',
      status: 504
    };
  }

  // GENERIC DATABASE ERROR
  return {
    success: false,
    error: 'An error occurred while processing your request. Please try again or contact support if the problem persists.',
    type: 'SYSTEM_ERROR',
    status: 500
  };
};

// ===== INPUT VALIDATION =====
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePhone = (phone) => {
  if (!phone) return true; // optional
  return /^\+?[0-9\s\-()]{7,}$/.test(phone);
};

const validateName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 255;
};

// ===== DASHBOARD HTML =====
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Africa Convention - Supervisor Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 28px; }
    .tabs { display: flex; background: white; border-bottom: 2px solid #667eea; }
    .tab-btn { padding: 15px 25px; cursor: pointer; background: #f5f5f5; border: none; font-size: 14px; font-weight: 500; color: #333; transition: 0.3s; flex: 1; text-align: center; }
    .tab-btn.active { background: white; color: #667eea; border-bottom: 3px solid #667eea; }
    .tab-btn:hover { background: #efefef; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    input, select { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    input.input-error { border-color: #dc3545 !important; background-color: #fff8f8 !important; }
    button { background: #667eea; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: 10px; margin-top: 10px; }
    button:hover { background: #764ba2; }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    
    /* ALERT STYLES */
    .alert { padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid; display: flex; justify-content: space-between; align-items: center; }
    .alert.success { background-color: #d4edda; color: #155724; border-color: #28a745; }
    .alert.error { background-color: #f8d7da; color: #721c24; border-color: #dc3545; }
    .alert.warning { background-color: #fff3cd; color: #856404; border-color: #ffc107; }
    .alert.info { background-color: #d1ecf1; color: #0c5460; border-color: #17a2b8; }
    .alert-title { font-weight: bold; font-size: 15px; margin-bottom: 5px; }
    .alert-message { font-size: 14px; }
    .alert-close { cursor: pointer; font-size: 20px; color: inherit; opacity: 0.7; }
    .alert-close:hover { opacity: 1; }
    
    .attendee-row { background: #f9f9f9; padding: 12px; margin: 8px 0; border-left: 4px solid #667eea; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 12px; margin-right: 5px; color: white; }
    .badge-checkin { background: #28a745; }
    .badge-checkout { background: #dc3545; }
    .badge-waiting { background: #ffc107; color: black; }
    .hidden { display: none !important; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    label { display: block; margin-bottom: 5px; color: #333; font-weight: 500; }
    .error-field { border-color: #dc3545 !important; }
    .field-error { color: #dc3545; font-size: 12px; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
<div class="header">
  <h1>🎊 Africa Convention 2026 - Supervisor Dashboard</h1>
  <p>Secure Event Management System | <span id="currentDate"></span></p>
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="openTab(event, 'dashboard')">📊 Live Dashboard</button>
  <button class="tab-btn" onclick="openTab(event, 'checkin')">✅ Check-in/Check-out</button>
  <button class="tab-btn" onclick="openTab(event, 'badges')">🎫 Badge Generator</button>
  <button class="tab-btn" onclick="openTab(event, 'statistics')">📈 Statistics</button>
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
    <h2>Attendees by Category</h2>
    <div id="byCategory"></div>
  </div>
</div>

<!-- TAB 2: CHECK-IN/CHECK-OUT -->
<div id="checkin" class="tab-content">
  <div class="card">
    <h2>✏️ Register New Attendee</h2>
    <div id="addMessage"></div>
    <div class="form-row">
      <div>
        <label>Full Name: <span style="color: red;">*</span></label>
        <input type="text" id="name" placeholder="Full Name" maxlength="255">
        <div class="field-error" id="nameError"></div>
      </div>
      <div>
        <label>Email: <span style="color: red;">*</span></label>
        <input type="email" id="email" placeholder="Email Address" maxlength="255">
        <div class="field-error" id="emailError"></div>
      </div>
    </div>
    <div class="form-row">
      <div>
        <label>Phone Number:</label>
        <input type="tel" id="phone" placeholder="+255700000000" maxlength="20">
        <div class="field-error" id="phoneError"></div>
      </div>
      <div>
        <label>Category:</label>
        <select id="category">
          <option value="">Select Category</option>
          <option value="Youth">Youth</option>
          <option value="Speaker">Speaker</option>
          <option value="Business">Business Leader</option>
          <option value="Staff">Staff</option>
        </select>
      </div>
    </div>
    <button onclick="addAttendee()" style="width: 100%; background: #28a745; padding: 15px; font-size: 16px; margin: 0; margin-top: 10px;">✅ Register Attendee</button>
  </div>

  <div class="card">
    <h2>⏰ Check-in / Check-out</h2>
    <div id="checkinMessage"></div>
    <label>QR Code or Attendee ID:</label>
    <input type="text" id="scanQR" placeholder="Paste QR code or ID here" autofocus>
    <div class="field-error" id="scanError"></div>
    
    <label>Staff Name:</label>
    <input type="text" id="staffName" placeholder="Your name">
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
      <button onclick="processCheckIn()" style="background: #28a745; padding: 15px; font-size: 16px; margin: 0;">✅ CHECK IN</button>
      <button onclick="processCheckOut()" style="background: #dc3545; padding: 15px; font-size: 16px; margin: 0;">❌ CHECK OUT</button>
    </div>
  </div>

  <div class="card">
    <h2>Recent Activity</h2>
    <div id="checkinLog" style="max-height: 500px; overflow-y: auto;"></div>
  </div>
</div>

<!-- TAB 3: BADGE GENERATOR -->
<div id="badges" class="tab-content">
  <div class="card">
    <h2>🎫 ID Badge Generator</h2>
    <div id="badgeMessage"></div>
    
    <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px;">
      <label><strong>Badge Format:</strong></label><br>
      <input type="radio" name="badgeFormat" value="pdf" checked> 📄 PDF (email to attendees)<br>
      <input type="radio" name="badgeFormat" value="html"> 🖨️ HTML (print on cards)
    </div>

    <div style="margin: 15px 0;">
      <button onclick="selectBadges('all')">✓ Select All</button>
      <button onclick="selectBadges('none')">✗ Clear</button>
      <span style="margin-left: 20px; font-weight: bold;">Selected: <span id="selectedCount">0</span> / <span id="totalCount">0</span></span>
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
    <h2>📊 Event Overview</h2>
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

</div>

<script>
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// ===== ALERT SYSTEM =====
function showAlert(message, type, containerId) {
  const container = document.getElementById(containerId);
  const alertId = 'alert-' + Date.now();
  const alertHTML = \`
    <div class="alert \${type}" id="\${alertId}">
      <div>
        <div class="alert-title">\${type === 'success' ? '✓ Success' : type === 'error' ? '✗ Error' : type === 'warning' ? '⚠ Warning' : 'ℹ Info'}</div>
        <div class="alert-message">\${message}</div>
      </div>
      <span class="alert-close" onclick="document.getElementById('\${alertId}').remove();">×</span>
    </div>
  \`;
  container.innerHTML = alertHTML;
  
  if (type === 'success') {
    setTimeout(() => {
      const el = document.getElementById(alertId);
      if (el) el.remove();
    }, 5000);
  }
}

function clearErrors() {
  document.getElementById('nameError').textContent = '';
  document.getElementById('emailError').textContent = '';
  document.getElementById('phoneError').textContent = '';
  document.getElementById('scanError').textContent = '';
  document.getElementById('name').classList.remove('input-error');
  document.getElementById('email').classList.remove('input-error');
  document.getElementById('phone').classList.remove('input-error');
  document.getElementById('scanQR').classList.remove('input-error');
}

// ===== TAB SWITCHING =====
function openTab(evt, tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  evt.currentTarget.classList.add('active');
  loadData();
}

// ===== LOAD DATA =====
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
    })
    .catch(e => console.error('Stats Error:', e));
}

function loadRecentActivity() {
  fetch('/api/activity/recent')
    .then(r => r.json())
    .then(data => {
      const activities = data.activities || [];
      let html = activities.length === 0 ? '<p style="color: #999;">No activity yet</p>' : '';
      activities.forEach(a => {
        const time = new Date(a.timestamp).toLocaleTimeString();
        const badge = a.action === 'CHECK_IN' ? '<span class="badge badge-checkin">✓ IN</span>' : '<span class="badge badge-checkout">✗ OUT</span>';
        html += '<div class="attendee-row"><div><strong>' + a.name + '</strong><br>' + badge + ' ' + time + ' by ' + (a.by || 'System') + '</div></div>';
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
        let badge = '<span class="badge badge-waiting">⏳ Waiting</span>';
        if (a.checked_in && !a.checked_out) badge = '<span class="badge badge-checkin">✓ In</span>';
        else if (a.checked_out) badge = '<span class="badge badge-checkout">✗ Out</span>';
        html += '<label style="padding: 8px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; cursor: pointer; display: block;"><input type="checkbox" class="badge-checkbox" data-id="' + a.id + '" value="' + a.id + '"> <strong>' + a.name + '</strong> (' + a.category + ') ' + badge + '</label>';
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
      let table = '<table><tr><th>Category</th><th>Total</th><th>In Event</th><th>Out</th><th>Waiting</th><th>Rate</th></tr>';
      categories.forEach(c => {
        const pct = c.total > 0 ? Math.round((c.checked / c.total) * 100) : 0;
        html += '<div style="margin: 15px 0;"><strong>' + c.category + '</strong>: ' + c.checked + ' / ' + c.total + ' (' + pct + '%)<div style="width: 100%; height: 25px; background: #e0e0e0; border-radius: 4px; overflow: hidden;"><div style="width: ' + pct + '%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">' + pct + '%</div></div></div>';
        table += '<tr><td>' + c.category + '</td><td>' + c.total + '</td><td>' + c.checked + '</td><td>' + (c.checkedOut || 0) + '</td><td>' + (c.total - c.checked - (c.checkedOut || 0)) + '</td><td>' + pct + '%</td></tr>';
      });
      table += '</table>';
      document.getElementById('categoryStats').innerHTML = html;
      document.getElementById('byCategory').innerHTML = html;
      document.getElementById('detailedReport').innerHTML = table;
      document.getElementById('statsDetail').innerHTML = '<p>Total attendees: <strong>' + (categories.reduce((a, c) => a + c.total, 0)) + '</strong></p>';
    });
}

// ===== VALIDATION & ADD ATTENDEE =====
function validateAddForm() {
  clearErrors();
  let isValid = true;
  
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  
  if (!name || name.length < 2) {
    document.getElementById('nameError').textContent = 'Please enter a valid name (at least 2 characters)';
    document.getElementById('name').classList.add('input-error');
    isValid = false;
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('emailError').textContent = 'Please enter a valid email address';
    document.getElementById('email').classList.add('input-error');
    isValid = false;
  }
  
  if (phone && !/^\+?[0-9\s\-()]{7,}$/.test(phone)) {
    document.getElementById('phoneError').textContent = 'Please enter a valid phone number';
    document.getElementById('phone').classList.add('input-error');
    isValid = false;
  }
  
  return isValid;
}

function addAttendee() {
  if (!validateAddForm()) return;
  
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const category = document.getElementById('category').value;

  fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, phone, category })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showAlert('✓ Attendee registered successfully! ID: ' + data.id + ' | QR: ' + data.qrCode, 'success', 'addMessage');
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('category').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Failed to register attendee', 'error', 'addMessage');
      }
    })
    .catch(e => showAlert('Connection error. Please try again.', 'error', 'addMessage'));
}

// ===== CHECK-IN/CHECK-OUT =====
function processCheckIn() {
  const input = document.getElementById('scanQR').value.trim();
  const staffName = document.getElementById('staffName').value.trim() || 'System';

  if (!input) {
    showAlert('Please enter a QR code or Attendee ID', 'warning', 'checkinMessage');
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
        showAlert(data.message || '✓ Checked in: ' + data.name, 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Check-in failed', 'error', 'checkinMessage');
      }
    })
    .catch(e => showAlert('Connection error. Please try again.', 'error', 'checkinMessage'));
}

function processCheckOut() {
  const input = document.getElementById('scanQR').value.trim();
  const staffName = document.getElementById('staffName').value.trim() || 'System';

  if (!input) {
    showAlert('Please enter a QR code or Attendee ID', 'warning', 'checkinMessage');
    return;
  }

  fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrOrId: input, staffName: staffName })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showAlert(data.message || '✗ Checked out: ' + data.name, 'success', 'checkinMessage');
        document.getElementById('scanQR').value = '';
        loadData();
      } else {
        showAlert(data.error || 'Check-out failed', 'error', 'checkinMessage');
      }
    })
    .catch(e => showAlert('Connection error. Please try again.', 'error', 'checkinMessage'));
}

// ===== BADGE MANAGEMENT =====
function updateBadgeCount() {
  const selected = document.querySelectorAll('.badge-checkbox:checked').length;
  document.getElementById('selectedCount').textContent = selected;
}

function selectBadges(type) {
  document.querySelectorAll('.badge-checkbox').forEach(cb => cb.checked = (type === 'all'));
  updateBadgeCount();
}

function generateBadges() {
  const selected = Array.from(document.querySelectorAll('.badge-checkbox:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showAlert('Please select at least one attendee', 'warning', 'badgeMessage');
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
          showAlert('Badges downloaded successfully', 'success', 'badgeMessage');
        });
      } else {
        return r.text().then(html => {
          const w = window.open();
          w.document.write(html);
          showAlert('Badges opened in new window', 'success', 'badgeMessage');
        });
      }
    })
    .catch(e => showAlert('Error generating badges. Please try again.', 'error', 'badgeMessage'));
}

setInterval(loadData, 5000);
loadData();
</script>
</body>
</html>
  `);
});

// ===== API ENDPOINTS =====

// ADD ATTENDEE
app.post('/api/add', async (req, res) => {
  const { name, email, phone, category } = req.body;

  // Input validation
  if (!name || name.trim().length < 2) {
    return res.json({ success: false, error: 'Name must be at least 2 characters long.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ success: false, error: 'Please provide a valid email address.' });
  }
  if (phone && !/^\+?[0-9\s\-()]{7,}$/.test(phone)) {
    return res.json({ success: false, error: 'Phone number format is invalid.' });
  }

  try {
    const qr = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result = await pool.query(
      'INSERT INTO attendees (name, email, phone, category, qr_code, registration_source) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, qr_code',
      [name.trim(), email.trim(), phone.trim() || null, category || null, qr, 'manual']
    );

    if (result.rows.length > 0) {
      res.json({ success: true, id: result.rows[0].id, qrCode: result.rows[0].qr_code, message: 'Attendee registered successfully!' });
    }
  } catch (err) {
    const errorResp = handleError(err, 'ADD_ATTENDEE');
    res.status(errorResp.status).json(errorResp);
  }
});

// CHECK-IN
app.post('/api/checkin', async (req, res) => {
  const { qrOrId, staffName } = req.body;

  if (!qrOrId || qrOrId.trim().length === 0) {
    return res.json({ success: false, error: 'Please provide a QR code or Attendee ID.' });
  }

  try {
    const query = isNaN(qrOrId) 
      ? 'SELECT * FROM attendees WHERE qr_code = $1' 
      : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId.trim()]);

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Attendee not found. Please check the QR code or ID.' });
    }

    const attendee = result.rows[0];

    if (attendee.checked_in && !attendee.checked_out) {
      return res.json({ success: false, error: attendee.name + ' is already checked in.' });
    }

    if (attendee.checked_out) {
      return res.json({ success: false, error: attendee.name + ' has already checked out. Please contact admin to re-check-in.' });
    }

    await pool.query(
      'UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1, checked_out = false, checked_out_at = NULL WHERE id = $2',
      [staffName || 'System', attendee.id]
    );

    res.json({ success: true, name: attendee.name, message: '✓ ' + attendee.name + ' checked in at ' + new Date().toLocaleTimeString() });
  } catch (err) {
    const errorResp = handleError(err, 'CHECK_IN');
    res.status(errorResp.status).json(errorResp);
  }
});

// CHECK-OUT
app.post('/api/checkout', async (req, res) => {
  const { qrOrId, staffName } = req.body;

  if (!qrOrId || qrOrId.trim().length === 0) {
    return res.json({ success: false, error: 'Please provide a QR code or Attendee ID.' });
  }

  try {
    const query = isNaN(qrOrId)
      ? 'SELECT * FROM attendees WHERE qr_code = $1'
      : 'SELECT * FROM attendees WHERE id = $1';
    const result = await pool.query(query, [qrOrId.trim()]);

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Attendee not found. Please check the QR code or ID.' });
    }

    const attendee = result.rows[0];

    if (!attendee.checked_in) {
      return res.json({ success: false, error: attendee.name + ' is not checked in. Cannot check out.' });
    }

    if (attendee.checked_out) {
      return res.json({ success: false, error: attendee.name + ' has already checked out.' });
    }

    await pool.query(
      'UPDATE attendees SET checked_out = true, checked_out_at = CURRENT_TIMESTAMP WHERE id = $1',
      [attendee.id]
    );

    res.json({ success: true, name: attendee.name, message: '✗ ' + attendee.name + ' checked out at ' + new Date().toLocaleTimeString() });
  } catch (err) {
    const errorResp = handleError(err, 'CHECK_OUT');
    res.status(errorResp.status).json(errorResp);
  }
});

// GET STATS
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees'
    );

    const total = parseInt(result.rows[0].total) || 0;
    const checked = parseInt(result.rows[0].checked) || 0;
    const checkedOut = parseInt(result.rows[0].checkedout) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;

    res.json({ success: true, total, checked, checkedOut, rate });
  } catch (err) {
    const errorResp = handleError(err, 'GET_STATS');
    res.status(errorResp.status).json(errorResp);
  }
});

// GET RECENT ACTIVITY
app.get('/api/activity/recent', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT name, checked_in_at as timestamp, 'CHECK_IN' as action, checked_in_by as by FROM attendees WHERE checked_in = true UNION ALL SELECT name, checked_out_at as timestamp, 'CHECK_OUT' as action, checked_in_by as by FROM attendees WHERE checked_out = true ORDER BY timestamp DESC LIMIT 20"
    );
    res.json({ success: true, activities: result.rows });
  } catch (err) {
    const errorResp = handleError(err, 'GET_ACTIVITY');
    res.status(errorResp.status).json(errorResp);
  }
});

// GET ATTENDEES
app.get('/api/attendees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, category, checked_in, checked_in_at, checked_out, checked_out_at FROM attendees ORDER BY id DESC'
    );
    res.json({ success: true, attendees: result.rows });
  } catch (err) {
    const errorResp = handleError(err, 'GET_ATTENDEES');
    res.status(errorResp.status).json(errorResp);
  }
});

// GET STATS BY CATEGORY
app.get('/api/stats/by-category', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT category, COUNT(*) as total, COUNT(CASE WHEN checked_in = true AND checked_out = false THEN 1 END) as checked, COUNT(CASE WHEN checked_out = true THEN 1 END) as checkedOut FROM attendees GROUP BY category ORDER BY category'
    );
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    const errorResp = handleError(err, 'GET_CATEGORY_STATS');
    res.status(errorResp.status).json(errorResp);
  }
});

// GENERATE BADGES
app.post('/api/badges/generate', async (req, res) => {
  const { attendeeIds, format } = req.body;

  if (!attendeeIds || attendeeIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Please select at least one attendee.' });
  }

  try {
    const placeholders = attendeeIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT id, name, email, category, qr_code FROM attendees WHERE id IN (${placeholders})`,
      attendeeIds
    );

    const attendees = result.rows;

    if (attendees.length === 0) {
      return res.status(404).json({ success: false, error: 'No attendees found.' });
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="badges-' + new Date().toISOString().split('T')[0] + '.pdf"');
      let pdfContent = '%PDF-1.4\n';
      attendees.forEach((a, i) => {
        pdfContent += '% Attendee ' + (i + 1) + ': ' + a.name + '\n';
      });
      pdfContent += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 200 >>\nstream\nBT\n/F1 20 Tf\n50 750 Td\n(ID Badges - ' + attendees.length + ' Attendees) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n500\n%%EOF';
      res.send(pdfContent);
    } else {
      let html = '<html><head><title>ID Badges</title><style>body{margin:20px;font-family:Arial}.badge{display:inline-block;width:3.5in;border:2px solid #667eea;padding:15px;margin:10px;page-break-inside:avoid;text-align:center}.badge-name{font-size:16px;font-weight:bold;margin:10px 0}.badge-cat{font-size:12px;color:#666}.badge-qr{margin-top:15px}</style></head><body>';
      for (const attendee of attendees) {
        html += '<div class="badge"><div class="badge-name">' + attendee.name + '</div><div class="badge-cat">' + (attendee.category || 'Attendee') + '</div><div class="badge-qr">' + attendee.qr_code + '</div></div>';
      }
      html += '</body></html>';
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    const errorResp = handleError(err, 'GENERATE_BADGES');
    res.status(errorResp.status).json(errorResp);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'Africa Convention API', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎊 AFRICA CONVENTION 2026 - SUPERVISOR DASHBOARD');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✓ Server running on port: ' + PORT);
  console.log('  ✓ Dashboard: http://localhost:' + PORT);
  console.log('  ✓ API Health: http://localhost:' + PORT + '/api/health');
  console.log('  ✓ Environment: Production (Error Handling Enabled)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
});
