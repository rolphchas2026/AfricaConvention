const fs = require('fs');
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let pool = null;
const dbConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'shared-db',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'ArushaPassword2026',
      database: process.env.DB_NAME || 'africa_convention',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    };

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const imagesPath = path.join(__dirname, 'sysimages');
const docsPath = path.join(__dirname, 'documentation');

function getGalleryImages() {
  if (!fs.existsSync(imagesPath)) return [];
  return fs.readdirSync(imagesPath)
    .filter(name => /\.(jpe?g|png|webp|gif)$/i.test(name))
    .map(name => `/sysimages/${encodeURIComponent(name)}`);
}
app.use('/sysimages', express.static(imagesPath));
app.use('/documentation', express.static(docsPath));

const TICKET_TYPES = {
  'general': { name: 'General Admin (Local)', price: 10000, currency: 'TZS', icon: '👔' },
  'foreigners': { name: 'Foreigners (VIP)', price: 350, currency: 'USD', icon: '✈️' },
  'youth': { name: 'Youth', price: 200, currency: 'USD', icon: '🎓' },
  'speaker': { name: 'Speaker', price: 300, currency: 'USD', icon: '🎤' },
  'business': { name: 'Business', price: 250, currency: 'USD', icon: '💼' }
};

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Africa2026!';
const adminSessions = new Map();

function generateAdminToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function initializeDatabase() {
  console.log('🔧 Initializing database...');
  let retries = 0;
  
  while (retries < 30) {
    try {
      pool = new Pool(dbConfig);
      const client = await pool.connect();
      console.log('✅ Database connected!');
      client.release();
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendees (
          id SERIAL PRIMARY KEY,
          ticket_id VARCHAR(255) UNIQUE NOT NULL,
          qr_code TEXT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          organization VARCHAR(255),
          title VARCHAR(255),
          ticket_type VARCHAR(50),
          ticket_price DECIMAL(10,2),
          currency VARCHAR(10),
          payment_method VARCHAR(50),
          payment_status VARCHAR(50) DEFAULT 'PENDING',
          registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checked_in BOOLEAN DEFAULT false,
          checked_in_at TIMESTAMP,
          checked_out BOOLEAN DEFAULT false,
          checked_out_at TIMESTAMP,
          badge_generated BOOLEAN DEFAULT false,
          badge_sent BOOLEAN DEFAULT false,
          verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('✅ Database ready');
      return true;
    } catch (error) {
      retries++;
      console.log(`⏳ Retry ${retries}/30...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// BEAUTIFUL LANDING PAGE WITH REGISTRATION & GALLERY
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Africa Convention 2026</title>
  // ...existing code...
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); min-height: 100vh; }

    nav { background: rgba(255,255,255,0.95); padding: 20px 40px; display: flex; justify-content: center; align-items: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px); animation: slideDown 0.6s ease-out; }
    @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    nav h1, .hero h2, .section h2, .ticket-card h3, .contact-section h2, .contact-card h3 {
      text-align: center;
      background: linear-gradient(135deg, #ffffff 0%, #ffb7ff 40%, #72d6ff 60%, #ffe37f 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 12px rgba(255,255,255,0.85), 0 10px 20px rgba(102,126,234,0.18);
    }

    nav h1 { font-size: 28px; font-weight: 800; letter-spacing: 0.03em; }
    nav a { padding: 12px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; transition: all 0.3s; cursor: pointer; box-shadow: 0 4px 15px rgba(102,126,234,0.3); }
    nav a:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102,126,234,0.5); }

    .hero { background: linear-gradient(135deg, #667eea, #f093fb); color: white; padding: 100px 40px; text-align: center; animation: fadeInUp 0.8s ease-out; }
    .hero p { font-size: 18px; margin-bottom: 30px; opacity: 0.95; }

    .section { padding: 60px 40px; }
    .gallery-section { background: white; }

    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
    .gallery-item { cursor: pointer; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.1); transition: all 0.35s; animation: slideUp 0.6s ease-out; background: #fff; }
    .gallery-item:hover { transform: translateY(-10px); box-shadow: 0 18px 45px rgba(102,126,234,0.25); }
    .gallery-item img { width: 100%; height: 250px; object-fit: cover; display: block; }
    .gallery-caption { padding: 14px 16px 20px; font-size: 15px; font-weight: 700; color: #333; text-align: center; background: #fff; }

    .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.75); align-items: center; justify-content: center; animation: fadeIn 0.3s; }
    .modal.active { display: flex; }
    .modal-content { background-color: white; padding: 30px; border-radius: 20px; position: relative; max-width: 90%; max-height: 90%; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: scaleIn 0.3s; }
    .close-btn { position: absolute; top: 15px; right: 20px; font-size: 32px; font-weight: bold; cursor: pointer; color: #667eea; }
    .modal-image { width: 100%; max-width: 800px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }

    .tickets { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto; }
    .ticket-card { background: white; padding: 30px; border-radius: 15px; text-align: center; box-shadow: 0 5px 20px rgba(0,0,0,0.08); transition: all 0.3s; animation: fadeInUp 0.8s ease-out; }
    .ticket-card button { width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; }
    .ticket-card button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(102,126,234,0.4); }

    .registration-form { background: white; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; }
    .form-group button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }

    footer { background: linear-gradient(135deg, #333, #555); color: white; text-align: center; padding: 40px; margin-top: 60px; }
    .contact-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 40px; text-align: center; }

    @media (max-width: 900px) {
      nav { padding: 18px 20px; }
      .hero { padding: 80px 24px; }
      .section { padding: 40px 20px; }
      .gallery { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
      .tickets { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      nav { flex-direction: column; gap: 12px; }
      .hero h2 { font-size: 34px; }
      .gallery-item img { height: 220px; }
      .modal-content { padding: 22px; }
    }
  </style>
</head>
<body>
  <nav>
    <h1>🎪 Africa Convention 2026</h1>
    <a href="/admin-login">Admin Login</a>
  </nav>

  <div class="hero">
    <h2>Doing Business and Bearing Fruitful</h2>
    <p>June 18-22, 2026 | Arusha, Tanzania</p>
  </div>

    
    <div class="gallery-section">
    <h2>Event Gallery</h2>
    <p>Experience the Africa Convention 2026</p>
    <div class="gallery" id="gallery"></div>
  </div>


  <div class="section" style="background: #f9f9f9;">
    <h2>Register for the Convention</h2>
    <p>Choose your ticket type and register</p>
    <div class="registration-form">
      <div id="regMsg"></div>
      <div class="form-group">
        <label>Ticket Type</label>
        <select id="ticketType" required>
          <option value="">Select Ticket Type</option>
          <option value="general">General Admin (Local) - 10,000 TZS</option>
          <option value="foreigners">Foreigners (VIP) - $350 USD</option>
          <option value="youth">Youth - $200 USD</option>
          <option value="speaker">Speaker - $300 USD</option>
          <option value="business">Business - $250 USD</option>
        </select>
      </div>
      <div class="form-group">
        <label>Full Name *</label>
        <input type="text" id="name" placeholder="Your full name" required>
      </div>
      <div class="form-group">
        <label>Email *</label>
        <input type="email" id="email" placeholder="your.email@example.com" required>
      </div>
      <div class="form-group">
        <label>Phone *</label>
        <input type="tel" id="phone" placeholder="+255 7xx xxx xxx" required>
      </div>
      <div class="form-group">
        <label>Organization</label>
        <input type="text" id="organization" placeholder="Your organization">
      </div>
      <div class="form-group">
        <label>Title/Position</label>
        <input type="text" id="title" placeholder="Your title">
      </div>
      <div class="form-group">
        <button onclick="registerAttendee()">Register Now</button>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Ticket Options</h2>
    <div class="tickets" id="ticketsContainer"></div>
  </div>

  <div class="contact-section">
    <h2>Contact Information</h2>
    <div class="contact-info">
      <div class="contact-card">
        <h3>📞 Phone</h3>
        <p>+255 787 576 900</p>
        <p>+255 713 276 655</p>
      </div>
      <div class="contact-card">
        <h3>📧 Email</h3>
        <p>wccm.tz@gmail.com</p>
      </div>
      <div class="contact-card">
        <h3>🌐 Website</h3>
        <p>www.livinghope.or.tz</p>
      </div>
    </div>
  </div>

  <footer>
    <p>© 2026 Africa Convention. All rights reserved.</p>
  </footer>

  <div id="modal" class="modal">
    <div class="modal-content">
      <span class="close-btn" onclick="closeGallery()">&times;</span>
      <img id="modalImage" class="modal-image" src="" alt="">
    </div>
  </div>

  
 // ...existing code...
  <script>
    const galleryImages = ${JSON.stringify(getGalleryImages())};
    const gallery = document.getElementById('gallery');
    const ticketsContainer = document.getElementById('ticketsContainer');

    function formatImageTitle(filename) {
      return decodeURIComponent(filename)
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function renderGallery() {
      gallery.innerHTML = '';
      galleryImages.forEach((img, i) => {
        const title = formatImageTitle(img.split('/').pop());
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML =
          '<img src="' + img + '" alt="' + title + '" title="' + title + '" style="width:100%; height:250px; object-fit:cover;">' +
          '<div class="gallery-caption">' + title + '</div>';
        div.onclick = function() { openGallery(i); };
        gallery.appendChild(div);
      });
    }

    function openGallery(index) {
      document.getElementById('modalImage').src = galleryImages[index];
      document.getElementById('modal').classList.add('active');
    }

    function closeGallery() {
      document.getElementById('modal').classList.remove('active');
    }

    window.onclick = function(e) {
      if (e.target === document.getElementById('modal')) {
        closeGallery();
      }
    };

    const ticketTypes = ${JSON.stringify(TICKET_TYPES)};

    function renderTicketOptions() {
      if (!ticketsContainer) return;
      ticketsContainer.innerHTML = '';
      Object.entries(ticketTypes).forEach(function([type, data]) {
        const card = document.createElement('div');
        card.className = 'ticket-card';
        card.innerHTML =
          '<h3>' + data.icon + ' ' + data.name + '</h3>' +
          '<p class="price">' + data.price.toLocaleString() + ' ' + data.currency + '</p>' +
          '<p style="margin: 0 0 18px; color: #555; font-size: 14px;">' +
            'Includes access to convention sessions, networking, and event materials.' +
          '</p>' +
          '<button type="button" onclick="selectTicketType(\\'' + type + '\\')">Select</button>';
        ticketsContainer.appendChild(card);
      });
    }

    function selectTicketType(type) {
      const select = document.getElementById('ticketType');
      if (select) select.value = type;
    }

    renderGallery();
    renderTicketOptions();
  </script>
</body>
</html>
  `);

});

// ADMIN DASHBOARD (same as before - keeping all functionality)
app.get('/admin', (req, res) => {
  const token = req.query.token;
  if (!token || !adminSessions.has(token)) {
    return res.redirect('/admin-login?error=1');
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Admin - Africa Convention 2026</title>
  // ...existing code...
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(180deg, #eef2f7 0%, #f8fbff 55%, #ffffff 100%);
      color: #2f3a45;
      min-height: 100vh;
    }

    nav {
      background: rgba(255,255,255,0.96);
      padding: 18px 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 10px 30px rgba(45,55,72,0.08);
      border-bottom: 1px solid rgba(100,116,139,0.12);
      animation: slideDown 0.6s ease-out;
    }
    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    nav h1,
    .hero h2,
    .section h2,
    .ticket-card h3,
    .contact-section h2,
    .contact-card h3 {
      text-align: center;
      background: linear-gradient(135deg, #5b8bfd, #7d93ff, #c5b5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 1px 14px rgba(255,255,255,0.65);
    }

    nav h1 {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    nav a {
      padding: 12px 26px;
      background: linear-gradient(135deg, #5b8bfd, #7d93ff);
      color: white;
      text-decoration: none;
      border-radius: 30px;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
      box-shadow: 0 8px 20px rgba(91,139,253,0.25);
    }
    nav a:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(91,139,253,0.35);
    }

    .hero {
      background: rgba(255,255,255,0.85);
      color: #2f3a45;
      padding: 90px 32px;
      text-align: center;
      border-radius: 32px;
      margin: 24px auto;
      max-width: 1080px;
      box-shadow: 0 18px 50px rgba(45,55,72,0.08);
    }
    .hero p {
      font-size: 18px;
      margin-top: 18px;
      color: #475160;
    }

    .section {
      padding: 48px 28px;
      max-width: 1180px;
      margin: 0 auto;
    }

    .gallery-section {
      background: rgba(255,255,255,0.96);
      border-radius: 28px;
      padding: 36px 28px 28px;
      box-shadow: 0 18px 50px rgba(45,55,72,0.08);
      margin-bottom: 36px;
      text-align: center;
    }
    .gallery-section h2 {
      margin-bottom: 12px;
      font-size: 34px;
      letter-spacing: 0.01em;
    }
    .gallery-section p {
      margin-bottom: 26px;
      color: #5b6b86;
      font-size: 16px;
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 22px;
      margin-top: 18px;
    }
    .gallery-item {
      cursor: pointer;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 12px 35px rgba(45,55,72,0.08);
      transition: transform 0.35s ease, box-shadow 0.35s ease;
      background: #ffffff;
    }
    .gallery-item:hover {
      transform: translateY(-6px);
      box-shadow: 0 18px 45px rgba(45,55,72,0.12);
    }
    .gallery-item img {
      width: 100%;
      height: 240px;
      object-fit: cover;
      display: block;
    }
    .gallery-caption {
      padding: 16px 14px 20px;
      font-size: 15px;
      font-weight: 700;
      color: #2f3a45;
      text-align: center;
      background: #fbfbff;
    }

    .tickets {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 24px;
      margin-top: 24px;
    }
    .ticket-card {
      background: #ffffff;
      padding: 28px;
      border-radius: 24px;
      text-align: center;
      box-shadow: 0 12px 30px rgba(45,55,72,0.08);
    }
    .ticket-card button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #5b8bfd, #7d93ff);
      color: white;
      border: none;
      border-radius: 18px;
      cursor: pointer;
      font-weight: 700;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .ticket-card button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(91,139,253,0.25);
    }

    .registration-form {
      background: #ffffff;
      padding: 36px;
      border-radius: 26px;
      margin: 0 auto;
      max-width: 720px;
      box-shadow: 0 18px 45px rgba(45,55,72,0.08);
    }
    .form-group input,
    .form-group select {
      width: 100%;
      padding: 14px;
      border: 1px solid #d7dbe6;
      border-radius: 14px;
      font-size: 15px;
      color: #2f3a45;
      margin-top: 10px;
    }
    .form-group button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #5b8bfd, #7d93ff);
      color: white;
      border: none;
      border-radius: 14px;
      font-weight: 700;
      margin-top: 12px;
    }

    .contact-section {
      background: rgba(255,255,255,0.96);
      border-radius: 28px;
      padding: 42px 28px;
      text-align: center;
      box-shadow: 0 18px 50px rgba(45,55,72,0.08);
    }
    .contact-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .contact-card {
      background: #f7f9ff;
      padding: 24px;
      border-radius: 20px;
      box-shadow: 0 12px 28px rgba(45,55,72,0.06);
    }

    footer {
      background: transparent;
      color: #475160;
      text-align: center;
      padding: 28px 20px;
      margin-top: 40px;
      font-size: 14px;
    }

    .modal-content { max-width: 90%; }
    .modal-image { max-height: 75vh; }

    @media (max-width: 900px) {
      .hero { padding: 60px 24px; }
      .section { padding: 36px 18px; }
      .gallery-item img { height: 220px; }
      .gallery-caption { padding: 14px; }
    }
    @media (max-width: 650px) {
      nav { padding: 16px 18px; }
      .hero { padding: 50px 18px; }
      .gallery-item img { height: 200px; }
      .registration-form { padding: 28px 18px; }
      .tickets { grid-template-columns: 1fr; }
      .contact-info { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Admin Dashboard</h1>
      <a onclick="logout()">Logout</a>
    </header>

    <div class="tabs-wrapper">
      <button class="tab-btn active" data-tab="academy">Academy</button>
      <button class="tab-btn" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="pending">Pending</button>
      <button class="tab-btn" data-tab="approval">Approval</button>
      <button class="tab-btn" data-tab="checkin">Check-in</button>
      <button class="tab-btn" data-tab="checkout">Check-out</button>
      <button class="tab-btn" data-tab="statistics">Statistics</button>
    </div>

    <div class="content-wrapper">
      
      <div id="academy" class="tab-content active">
        <h2>Academy</h2>
        <iframe src="/documentation/training.html"></iframe>
      </div>

      <div id="overview" class="tab-content">
        <h2>Overview</h2>
        <div class="stat-box"><div class="stat-number" id="stat-total">0</div><div class="stat-label">Total</div></div>
        <div class="stat-box"><div class="stat-number" id="stat-approved">0</div><div class="stat-label">Approved</div></div>
        <div class="stat-box"><div class="stat-number" id="stat-checked">0</div><div class="stat-label">Checked In</div></div>
        <div class="stat-box"><div class="stat-number" id="stat-pending">0</div><div class="stat-label">Pending</div></div>
        <h3>Activity</h3>
        <table><thead><tr><th>Time</th><th>Event</th><th>Name</th><th>Status</th></tr></thead><tbody id="activity"></tbody></table>
      </div>

      <div id="pending" class="tab-content">
        <h2>Pending</h2>
        <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Organization</th><th>Status</th></tr></thead><tbody id="pendingList"></tbody></table>
      </div>

      <div id="approval" class="tab-content">
        <h2>Approval</h2>
        <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody id="approvalList"></tbody></table>
      </div>

      <div id="checkin" class="tab-content">
        <h2>Check-in</h2>
        <div style="margin-bottom: 20px;">
          <input type="text" id="checkinInput" placeholder="Scan or Enter Ticket ID" style="max-width: 350px; padding: 12px;">
          <div id="checkinMsg" style="margin-top: 12px;"></div>
        </div>
        <h3>Recent Check-ins</h3>
        <table><thead><tr><th>Ticket ID</th><th>Name</th><th>Time</th><th>Type</th><th>Status</th></tr></thead><tbody id="checkinList"></tbody></table>
      </div>

      <div id="checkout" class="tab-content">
        <h2>Check-out</h2>
        <div style="margin-bottom: 20px;">
          <input type="text" id="checkoutInput" placeholder="Scan or Enter Ticket ID" style="max-width: 350px; padding: 12px;">
          <div id="checkoutMsg" style="margin-top: 12px;"></div>
        </div>
        <h3>Recent Check-outs</h3>
        <table><thead><tr><th>Ticket ID</th><th>Name</th><th>Time</th><th>Duration</th><th>Status</th></tr></thead><tbody id="checkoutList"></tbody></table>
      </div>

      <div id="statistics" class="tab-content">
        <h2>Statistics</h2>
        <h3>By Type</h3>
        <div id="stats"></div>
        <h3>All Attendees</h3>
        <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Organization</th><th>Checked In</th><th>Status</th></tr></thead><tbody id="attendeesList"></tbody></table>
      </div>

    </div>
  </div>

  <script>
    let token = new URLSearchParams(window.location.search).get('token');

    document.addEventListener('DOMContentLoaded', function() {
      setupTabSystem();
      loadOverview();
    });

    function setupTabSystem() {
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach((btn) => {
        const tabName = btn.getAttribute('data-tab');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          switchToTab(tabName);
        });
      });
    }

    function switchToTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      const tabContent = document.getElementById(tabName);
      const tabButton = document.querySelector('[data-tab="' + tabName + '"]');
      
      if (tabContent && tabButton) {
        tabContent.classList.add('active');
        tabButton.classList.add('active');
        
        if (tabName === 'overview') loadOverview();
        if (tabName === 'pending') loadPending();
        if (tabName === 'approval') loadApproval();
        if (tabName === 'checkin') { const inp = document.getElementById('checkinInput'); if (inp) inp.focus(); }
        if (tabName === 'checkout') { const inp = document.getElementById('checkoutInput'); if (inp) inp.focus(); }
        if (tabName === 'statistics') loadStatistics();
      }
    }

    async function loadOverview() {
      try {
        const res = await fetch('/api/registrations');
        const data = await res.json();
        document.getElementById('stat-total').textContent = data.length;
        document.getElementById('stat-approved').textContent = data.filter(a => a.payment_status === 'APPROVED').length;
        document.getElementById('stat-checked').textContent = data.filter(a => a.checked_in).length;
        document.getElementById('stat-pending').textContent = data.filter(a => a.payment_status === 'PENDING').length;
      } catch (err) { console.error(err); }
    }

    async function loadPending() {
      try {
        const res = await fetch('/api/registrations');
        const data = await res.json();
        const pending = data.filter(a => a.payment_status === 'PENDING');
        const list = document.getElementById('pendingList');
        list.innerHTML = '';
        if (pending.length === 0) {
          list.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No pending</td></tr>';
        } else {
          pending.forEach(a => {
            list.innerHTML += '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td>' + (a.organization || '-') + '</td><td><span class="badge badge-pending">Pending</span></td></tr>';
          });
        }
      } catch (err) { console.error(err); }
    }

    async function loadApproval() {
      try {
        const res = await fetch('/api/registrations');
        const data = await res.json();
        const list = document.getElementById('approvalList');
        list.innerHTML = '';
        data.forEach(a => {
          const status = a.payment_status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' : '<span class="badge badge-pending">Pending</span>';
          list.innerHTML += '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td>' + status + '</td><td><button onclick="approve(' + "'" + a.ticket_id + "'" + ')">Approve</button></td></tr>';
        });
      } catch (err) { console.error(err); }
    }

    async function loadStatistics() {
      try {
        const res = await fetch('/api/registrations');
        const data = await res.json();
        const counts = { general: 0, foreigners: 0, youth: 0, speaker: 0, business: 0 };
        data.forEach(a => { if (counts.hasOwnProperty(a.ticket_type)) counts[a.ticket_type]++; });
        let html = '';
        for (let [k, v] of Object.entries(counts)) {
          html += '<div class="stat-box"><div class="stat-number">' + v + '</div><div class="stat-label">' + k + '</div></div>';
        }
        document.getElementById('stats').innerHTML = html;
        
        const list = document.getElementById('attendeesList');
        list.innerHTML = '';
        data.forEach(a => {
          const checked = a.checked_in ? 'Yes' : 'No';
          const status = a.payment_status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' : '<span class="badge badge-pending">Pending</span>';
          list.innerHTML += '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td>' + (a.organization || '-') + '</td><td>' + checked + '</td><td>' + status + '</td></tr>';
        });
      } catch (err) { console.error(err); }
    }

    document.addEventListener('DOMContentLoaded', function() {
      const checkinInput = document.getElementById('checkinInput');
      if (checkinInput) {
        checkinInput.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter') {
            const tid = e.target.value.trim();
            if (!tid) return;
            try {
              const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket_id: tid }) });
              const result = await res.json();
              const msg = document.getElementById('checkinMsg');
              if (result.success) {
                msg.innerHTML = '<div class="info-msg success">✅ ' + result.name + ' checked in</div>';
              } else {
                msg.innerHTML = '<div class="info-msg error">❌ ' + result.error + '</div>';
              }
              e.target.value = '';
              setTimeout(() => loadOverview(), 500);
            } catch (err) {
              document.getElementById('checkinMsg').innerHTML = '<div class="info-msg error">❌ Error</div>';
            }
          }
        });
      }

      const checkoutInput = document.getElementById('checkoutInput');
      if (checkoutInput) {
        checkoutInput.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter') {
            const tid = e.target.value.trim();
            if (!tid) return;
            try {
              const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket_id: tid }) });
              const result = await res.json();
              const msg = document.getElementById('checkoutMsg');
              if (result.success) {
                msg.innerHTML = '<div class="info-msg success">✅ ' + result.name + ' checked out</div>';
              } else {
                msg.innerHTML = '<div class="info-msg error">❌ ' + result.error + '</div>';
              }
              e.target.value = '';
            } catch (err) {
              document.getElementById('checkoutMsg').innerHTML = '<div class="info-msg error">❌ Error</div>';
            }
          }
        });
      }
    });

    async function approve(tid) {
      if (!confirm('Approve?')) return;
      try {
        await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket_id: tid }) });
        loadApproval();
        loadOverview();
      } catch (err) {
        alert('Error');
      }
    }

    function logout() {
      window.location.href = '/api/admin-logout?token=' + token;
    }
  </script>
</body>
</html>`;

  res.send(html);
});

// API ENDPOINTS (same as before)
app.post('/api/register', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not ready' });
    const { ticket_type, name, email, phone, organization, title } = req.body;
    if (!ticket_type || !name || !email || !phone) return res.json({ success: false, error: 'Missing fields' });
    const ticket = TICKET_TYPES[ticket_type];
    const ticketId = 'TKT-' + Date.now();
    await pool.query('INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [ticketId, name, email, phone, organization || '', title || '', ticket_type, ticket.price, ticket.currency, 'APPROVED']);
    res.json({ success: true, ticket_id: ticketId });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not ready' });
    const { ticket_id } = req.body;
    const result = await pool.query('SELECT * FROM attendees WHERE ticket_id = $1', [ticket_id]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Ticket not found' });
    const attendee = result.rows[0];
    if (attendee.checked_in) return res.json({ success: false, error: 'Already checked in' });
    await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = NOW() WHERE ticket_id = $1', [ticket_id]);
    res.json({ success: true, name: attendee.name });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not ready' });
    const { ticket_id } = req.body;
    const result = await pool.query('SELECT * FROM attendees WHERE ticket_id = $1', [ticket_id]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Ticket not found' });
    const attendee = result.rows[0];
    if (!attendee.checked_in) return res.json({ success: false, error: 'Not checked in' });
    if (attendee.checked_out) return res.json({ success: false, error: 'Already checked out' });
    await pool.query('UPDATE attendees SET checked_out = true, checked_out_at = NOW() WHERE ticket_id = $1', [ticket_id]);
    res.json({ success: true, name: attendee.name });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/approve', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not ready' });
    const { ticket_id } = req.body;
    const result = await pool.query('SELECT * FROM attendees WHERE ticket_id = $1', [ticket_id]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Not found' });
    const qrData = JSON.stringify({ ticket_id, name: result.rows[0].name });
    const qrCode = await QRCode.toDataURL(qrData);
    await pool.query('UPDATE attendees SET payment_status = $1, qr_code = $2 WHERE ticket_id = $3', ['APPROVED', qrCode, ticket_id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/registrations', async (req, res) => {
  try {
    if (!pool) return res.json([]);
    const result = await pool.query('SELECT * FROM attendees ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateAdminToken();
    adminSessions.set(token, { username, loginTime: new Date() });
    return res.redirect('/admin?token=' + token);
  }
  res.redirect('/admin-login?error=1');
});

app.get('/api/admin-logout', (req, res) => {
  const token = req.query.token;
  if (token) adminSessions.delete(token);
  res.redirect('/');
});

app.get('/admin-login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admin Login</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Segoe UI'; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); display: flex; align-items: center; justify-content: center; height: 100vh; } .login { background: white; padding: 60px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 420px; } h1 { color: #667eea; margin-bottom: 15px; } p { color: #666; margin-bottom: 40px; } input { width: 100%; padding: 14px; margin-bottom: 16px; border: 2px solid #ddd; border-radius: 10px; font-size: 14px; } input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 15px rgba(102,126,234,0.2); } button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; } button:hover { box-shadow: 0 12px 30px rgba(102,126,234,0.4); } .error { color: #c92a2a; background: rgba(201,42,42,0.1); padding: 12px; border-radius: 8px; margin-bottom: 20px; }</style></head><body><div class="login"><h1>Admin Login</h1><p>Africa Convention 2026</p>${req.query.error ? '<div class="error">Invalid credentials</div>' : ''}<form method="POST" action="/api/admin-login"><input type="text" name="username" placeholder="admin" required autofocus><input type="password" name="password" placeholder="Africa2026!" required><button>Login</button></form></div></body></html>`);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log('\n✨ DASHBOARD WITH GENERAL ADMIN ON-DOOR REGISTRATION READY');
    console.log(`📍 http://localhost:${PORT}\n`);
  });
}

process.on('SIGINT', async () => {
  if (pool) await pool.end();
  process.exit(0);
});

start();
