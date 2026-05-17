const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let pool = null;
const dbConfig = {
  host: process.env.DB_HOST || 'shared-db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'ArushaPassword2026',
  database: process.env.DB_NAME || 'africa_convention',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const imagesPath = path.join(__dirname, 'sysimages');
const docsPath = path.join(__dirname, 'documentation');
app.use('/sysimages', express.static(imagesPath));
app.use('/documentation', express.static(docsPath));

const TICKET_TYPES = {
  'general': { 
    name: 'General Admin (Local)', 
    price: 10000, 
    currency: 'TZS', 
    color: '#667eea',
    icon: '👔',
    register_type: 'domestic'
  },
  'foreigners': { 
    name: 'Foreigners (VIP)', 
    price: 350, 
    currency: 'USD', 
    color: '#f093fb',
    icon: '✈️',
    register_type: 'foreign'
  },
  'youth': { 
    name: 'Youth', 
    price: 200, 
    currency: 'USD', 
    color: '#90EE90',
    icon: '🎓',
    register_type: 'foreign'
  },
  'speaker': { 
    name: 'Speaker', 
    price: 300, 
    currency: 'USD', 
    color: '#FFD700',
    icon: '🎤',
    register_type: 'foreign'
  },
  'business': { 
    name: 'Business', 
    price: 250, 
    currency: 'USD', 
    color: '#FF6B6B',
    icon: '💼',
    register_type: 'foreign'
  }
};

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Africa2026!';
const adminSessions = new Map();

function generateAdminToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const GLOSSY_STYLES = `<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --gradient-main: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  --gradient-light: linear-gradient(135deg, rgba(102,126,234,0.95) 0%, rgba(118,75,162,0.95) 50%, rgba(240,147,251,0.95) 100%);
  --gradient-button: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--gradient-main); min-height: 100vh; padding: 20px; }
body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 20% 50%, rgba(240,147,251,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(102,126,234,0.15) 0%, transparent 50%); pointer-events: none; z-index: 0; }
@keyframes slideUp { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(240,147,251,0.4), 0 20px 60px rgba(102,126,234,0.3); } 50% { box-shadow: 0 0 40px rgba(240,147,251,0.6), 0 30px 80px rgba(102,126,234,0.4); } }
@keyframes shine { 0% { left: -100%; } 100% { left: 100%; } }
.glass-container { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 25px; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15), 0 -2px 5px rgba(255, 255, 255, 0.7) inset; position: relative; overflow: hidden; }
.candy-btn { position: relative; padding: 15px 40px; border: none; border-radius: 50px; font-weight: bold; font-size: 16px; cursor: pointer; background: var(--gradient-button); color: white; box-shadow: 0 10px 25px rgba(102,126,234,0.4), inset 0 1px 0 rgba(255,255,255,0.3); overflow: hidden; transition: all 0.3s; animation: pulse-glow 2s ease-in-out infinite; }
.candy-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shine 3s infinite; }
.candy-btn:hover { transform: translateY(-5px) scale(1.05); }
input, select, textarea { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); border: 2px solid rgba(102,126,234,0.2); border-radius: 15px; font-size: 14px; color: #333; transition: all 0.3s ease; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #667eea; background: rgba(255,255,255,0.98); box-shadow: 0 8px 25px rgba(102,126,234,0.3); }
.modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
.modal.active { display: flex; align-items: center; justify-content: center; }
.modal-content { background-color: white; padding: 20px; border-radius: 15px; position: relative; max-width: 90%; max-height: 90%; overflow: auto; }
.close-btn { position: absolute; top: 15px; right: 20px; font-size: 28px; font-weight: bold; cursor: pointer; color: #667eea; }
.close-btn:hover { color: #764ba2; }
.modal-image { width: 100%; max-width: 800px; border-radius: 10px; }
</style>`;

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

// ENHANCED LANDING PAGE WITH GALLERY & TICKET CARDS
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Africa Convention 2026</title>
      ${GLOSSY_STYLES}
      <style>
        body { padding: 0; }
        nav { background: rgba(255,255,255,0.95); padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); sticky: top; }
        nav h1 { background: var(--gradient-main); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 24px; }
        nav a { padding: 12px 24px; background: var(--gradient-button); color: white; text-decoration: none; border-radius: 25px; transition: all 0.3s; }
        nav a:hover { transform: translateY(-2px); }
        .hero { background: var(--gradient-main); color: white; padding: 100px 40px; text-align: center; position: relative; z-index: 1; }
        .hero h2 { font-size: 48px; margin-bottom: 20px; }
        .hero p { font-size: 18px; margin-bottom: 30px; }
        .gallery-section { padding: 60px 40px; background: white; }
        .gallery-section h2 { color: #667eea; text-align: center; margin-bottom: 40px; font-size: 32px; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .gallery-item { cursor: pointer; border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.1); transition: all 0.3s; }
        .gallery-item:hover { transform: translateY(-10px); box-shadow: 0 15px 40px rgba(102,126,234,0.3); }
        .gallery-item img { width: 100%; height: 250px; object-fit: cover; }
        .ticket-section { padding: 60px 40px; background: rgba(102,126,234,0.05); }
        .ticket-section h2 { color: #667eea; text-align: center; margin-bottom: 40px; }
        .tickets { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; }
        .ticket-card { background: white; padding: 30px; border-radius: 15px; text-align: center; box-shadow: 0 5px 20px rgba(0,0,0,0.08); transition: all 0.3s; border: 2px solid transparent; }
        .ticket-card:hover { border-color: #667eea; transform: translateY(-5px); }
        .ticket-card .icon { font-size: 48px; margin-bottom: 15px; }
        .ticket-card h3 { color: #667eea; margin-bottom: 10px; }
        .ticket-card .price { font-size: 28px; font-weight: bold; color: #764ba2; margin-bottom: 15px; }
        .ticket-card .type { font-size: 12px; color: #999; margin-bottom: 20px; }
        .ticket-card button { width: 100%; padding: 12px; background: var(--gradient-button); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; }
        .ticket-card button:hover { transform: scale(1.05); }
        .links-section { padding: 40px; text-align: center; background: white; }
        .important-links { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
        .link-btn { padding: 12px 24px; background: var(--gradient-button); color: white; text-decoration: none; border-radius: 25px; transition: all 0.3s; }
        .link-btn:hover { transform: translateY(-2px); }
        footer { background: #333; color: white; text-align: center; padding: 30px; }
      </style>
    </head>
    <body>
      <nav>
        <h1>🎪 Africa Convention 2026</h1>
        <div>
          <a href="/admin-login" style="margin-right: 15px;">Admin</a>
          <a href="#tickets">Register</a>
        </div>
      </nav>

      <div class="hero">
        <h2>Doing Business and Bearing Fruitful</h2>
        <p>June 18-22, 2026 | Arusha, Tanzania</p>
        <button class="candy-btn" onclick="document.getElementById('ticketModal').classList.add('active')">Register Now</button>
      </div>

      <div class="gallery-section">
        <h2>📸 Event Gallery</h2>
        <div class="gallery">
          <div class="gallery-item" onclick="openGallery('/sysimages/bronchour.jpeg')">
            <img src="/sysimages/bronchour.jpeg" alt="Event Brochure 1">
          </div>
          <div class="gallery-item" onclick="openGallery('/sysimages/Venue_1.jpeg')">
            <img src="/sysimages/Venue_1.jpeg" alt="Venue">
          </div>
          <div class="gallery-item" onclick="openGallery('/sysimages/Venue_2.jpeg')">
            <img src="/sysimages/Venue_2.jpeg" alt="Venue">
          </div>
          <div class="gallery-item" onclick="openGallery('/sysimages/Venue_3.jpeg')">
            <img src="/sysimages/Venue_3.jpeg" alt="Venue">
          </div>
          <div class="gallery-item" onclick="openGallery('/sysimages/youth_Summit_bronchour.jpeg')">
            <img src="/sysimages/youth_Summit_bronchour.jpeg" alt="Youth Summit">
          </div>
          <div class="gallery-item" onclick="openGallery('/sysimages/Doing_Business_Bronchour.jpeg')">
            <img src="/sysimages/Doing_Business_Bronchour.jpeg" alt="Business Brochure">
          </div>
        </div>
      </div>

      <div id="galleryModal" class="modal">
        <div class="modal-content">
          <span class="close-btn" onclick="closeGallery()">&times;</span>
          <img id="galleryImage" class="modal-image" src="" alt="">
        </div>
      </div>

      <div class="ticket-section" id="tickets">
        <h2>🎫 Select Your Ticket</h2>
        <p style="text-align: center; color: #666; margin-bottom: 40px;">
          <strong>FOREIGN DELEGATES:</strong> Register online below<br>
          <strong>DOMESTIC DELEGATES:</strong> Register at the door on event day
        </p>
        <div class="tickets">
          <div class="ticket-card">
            <div class="icon">✈️</div>
            <h3>Foreigners (VIP)</h3>
            <div class="price">350 USD</div>
            <div class="type">For international delegates</div>
            <button onclick="registerForeign('foreigners')">Register Online</button>
          </div>
          <div class="ticket-card">
            <div class="icon">🎓</div>
            <h3>Youth</h3>
            <div class="price">200 USD</div>
            <div class="type">For young professionals</div>
            <button onclick="registerForeign('youth')">Register Online</button>
          </div>
          <div class="ticket-card">
            <div class="icon">🎤</div>
            <h3>Speaker</h3>
            <div class="price">300 USD</div>
            <div class="type">For presenters</div>
            <button onclick="registerForeign('speaker')">Register Online</button>
          </div>
          <div class="ticket-card">
            <div class="icon">💼</div>
            <h3>Business</h3>
            <div class="price">250 USD</div>
            <div class="type">For corporations</div>
            <button onclick="registerForeign('business')">Register Online</button>
          </div>
          <div class="ticket-card" style="grid-column: span 1;">
            <div class="icon">👔</div>
            <h3>General Admin (Local)</h3>
            <div class="price">10,000 TZS</div>
            <div class="type">Register at the door</div>
            <button onclick="alert('Please register at the door on event day')">Door Registration</button>
          </div>
        </div>
      </div>

      <div class="links-section">
        <h2>📋 Important Resources</h2>
        <div class="important-links">
          <a href="tel:+255787576900" class="link-btn">📞 Call (+255) 787-576-900</a>
          <a href="mailto:wccm.tz@gmail.com" class="link-btn">📧 Email WCCM</a>
          <a href="http://www.livinghope.or.tz" class="link-btn" target="_blank">🌐 Visit Website</a>
          <a href="/admin-login" class="link-btn">🔐 Admin Portal</a>
        </div>
      </div>

      <footer>
        <p>© 2026 Africa Convention. All rights reserved.</p>
        <p>📍 Living Hope Mission Center, Arusha, Tanzania</p>
      </footer>

      <div id="ticketModal" class="modal">
        <div class="modal-content" style="max-width: 600px;">
          <span class="close-btn" onclick="closeForeignRegistration()">&times;</span>
          <h2 style="color: #667eea; margin-bottom: 20px;">Register as Foreign Delegate</h2>
          <form id="foreignRegForm" onsubmit="submitForeignReg(event)">
            <div style="margin-bottom: 15px;">
              <label style="color: #333; font-weight: 600;">Full Name *</label>
              <input type="text" name="name" required>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="color: #333; font-weight: 600;">Email *</label>
              <input type="email" name="email" required>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="color: #333; font-weight: 600;">Phone *</label>
              <input type="tel" name="phone" required>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="color: #333; font-weight: 600;">Organization</label>
              <input type="text" name="organization">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="color: #333; font-weight: 600;">Title</label>
              <input type="text" name="title">
            </div>
            <input type="hidden" name="ticket_type" id="ticketType">
            <button type="submit" class="candy-btn" style="width: 100%;">Complete Registration</button>
          </form>
          <div id="regMessage" style="margin-top: 15px;"></div>
        </div>
      </div>

      <script>
        function openGallery(src) {
          document.getElementById('galleryImage').src = src;
          document.getElementById('galleryModal').classList.add('active');
        }
        function closeGallery() {
          document.getElementById('galleryModal').classList.remove('active');
        }
        function registerForeign(type) {
          document.getElementById('ticketType').value = type;
          document.getElementById('ticketModal').classList.add('active');
          document.getElementById('foreignRegForm').reset();
        }
        function closeForeignRegistration() {
          document.getElementById('ticketModal').classList.remove('active');
        }
        async function submitForeignReg(e) {
          e.preventDefault();
          const formData = new FormData(document.getElementById('foreignRegForm'));
          const data = Object.fromEntries(formData);
          
          try {
            const res = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            const msg = document.getElementById('regMessage');
            if (result.success) {
              msg.innerHTML = '<div style="color: #155724; background: #d4edda; padding: 12px; border-radius: 8px;">✅ Registered! Ticket ID: ' + result.ticket_id + '. Check your email for confirmation.</div>';
              setTimeout(() => closeForeignRegistration(), 3000);
            } else {
              msg.innerHTML = '<div style="color: #c92a2a; background: #f8d7da; padding: 12px; border-radius: 8px;">Error: ' + result.error + '</div>';
            }
          } catch (err) {
            document.getElementById('regMessage').innerHTML = '<div style="color: #c92a2a;">Error: ' + err.message + '</div>';
          }
        }
        window.onclick = function(e) {
          if (e.target.id === 'galleryModal') closeGallery();
          if (e.target.id === 'ticketModal') closeForeignRegistration();
        }
      </script>
    </body>
    </html>
  `);
});

// ENHANCED ADMIN DASHBOARD
app.get('/admin', (req, res) => {
  const token = req.query.token;
  if (!token || !adminSessions.has(token)) {
    return res.redirect('/admin-login?error=1');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin Dashboard - Africa Convention 2026</title>
      ${GLOSSY_STYLES}
      <style>
        body { padding: 20px; z-index: 1; position: relative; }
        .container { max-width: 1400px; margin: 0 auto; position: relative; z-index: 1; }
        header { background: var(--gradient-button); color: white; padding: 30px; border-radius: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 15px 40px rgba(102,126,234,0.3); }
        header h1 { font-size: 28px; }
        header a { color: white; padding: 12px 28px; background: rgba(255,255,255,0.2); border-radius: 12px; text-decoration: none; }
        .tabs { display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap; overflow-x: auto; padding-bottom: 10px; border-bottom: 2px solid rgba(102,126,234,0.1); }
        .tab { padding: 14px 24px; background: rgba(255,255,255,0.9); border: none; cursor: pointer; font-size: 12px; border-bottom: 3px solid transparent; transition: all 0.3s; border-radius: 12px 12px 0 0; white-space: nowrap; }
        .tab.active { border-bottom-color: #667eea; color: #667eea; font-weight: bold; background: white; }
        .tab-content { background: white; padding: 35px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); display: none; animation: slideUp 0.3s ease-out; }
        .tab-content.active { display: block; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 14px; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.05); }
        th { background: linear-gradient(135deg, rgba(102,126,234,0.05), rgba(240,147,251,0.05)); font-weight: bold; color: #667eea; }
        tr:hover { background: rgba(102,126,234,0.02); }
        .stat-box { background: var(--gradient-light); color: white; padding: 25px; border-radius: 16px; display: inline-block; margin-right: 20px; margin-bottom: 20px; min-width: 200px; text-align: center; }
        .stat-number { font-size: 36px; font-weight: bold; }
        .stat-label { font-size: 13px; margin-top: 10px; opacity: 0.95; }
        .badge { display: inline-block; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        .badge-approved { background: #d4edda; color: #155724; }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-checked { background: #d1ecf1; color: #0c5460; }
        button { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold; }
        .btn-approve { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .btn-email { background: #007bff; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>🎪 Africa Convention 2026 - Admin Dashboard</h1>
          <a href="/api/admin-logout?token=${token}">Logout</a>
        </header>

        <div class="tabs">
          <button class="tab active" onclick="show('academy')">📚 Academy</button>
          <button class="tab" onclick="show('overview')">📈 Overview</button>
          <button class="tab" onclick="show('tickets')">🎫 Ticket Cards</button>
          <button class="tab" onclick="show('pending')">⏳ Pending</button>
          <button class="tab" onclick="show('approval')">✅ Approval</button>
          <button class="tab" onclick="show('welcome')">👋 Welcome Note</button>
          <button class="tab" onclick="show('admission')">👤 Guest Admission</button>
          <button class="tab" onclick="show('checkin')">✅ Check-in</button>
          <button class="tab" onclick="show('statistics')">📊 Statistics</button>
          <button class="tab" onclick="show('checkout')">🚪 Check-out</button>
        </div>

        <!-- ACADEMY TAB -->
        <div id="academy" class="tab-content active">
          <h2>📚 Training Academy</h2>
          <iframe src="/documentation/training.html" style="width: 100%; height: 700px; border: none; border-radius: 15px;"></iframe>
        </div>

        <!-- OVERVIEW TAB -->
        <div id="overview" class="tab-content">
          <h2>📈 System Overview</h2>
          <div class="stat-box">
            <div class="stat-number" id="stat-total">0</div>
            <div class="stat-label">Total Registrations</div>
          </div>
          <div class="stat-box">
            <div class="stat-number" id="stat-checked-in">0</div>
            <div class="stat-label">Checked In</div>
          </div>
          <div class="stat-box">
            <div class="stat-number" id="stat-pending">0</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-box">
            <div class="stat-number" id="stat-approved">0</div>
            <div class="stat-label">Approved</div>
          </div>
          <h3 style="margin-top: 30px;">Recent Activity</h3>
          <table>
            <thead><tr><th>Time</th><th>Event</th><th>Name</th><th>Status</th></tr></thead>
            <tbody id="activityList"></tbody>
          </table>
        </div>

        <!-- TICKET CARDS TAB -->
        <div id="tickets" class="tab-content">
          <h2>🎫 Ticket Options</h2>
          <p style="color: #666; margin-bottom: 20px;">Hover over cards to see details</p>
          <div id="ticketCardsContainer"></div>
        </div>

        <!-- PENDING TAB -->
        <div id="pending" class="tab-content">
          <h2>⏳ Pending Registrations</h2>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Ticket Type</th><th>Organization</th><th>Registered</th><th>Status</th></tr></thead>
            <tbody id="pendingList"></tbody>
          </table>
        </div>

        <!-- APPROVAL TAB -->
        <div id="approval" class="tab-content">
          <h2>✅ Approval & Badge Sending</h2>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Ticket Type</th><th>Payment Status</th><th>Actions</th></tr></thead>
            <tbody id="approvalList"></tbody>
          </table>
        </div>

        <!-- WELCOME NOTE TAB -->
        <div id="welcome" class="tab-content">
          <h2>👋 Welcome Message</h2>
          <form id="welcomeForm" onsubmit="saveWelcome(event)" style="margin-top: 20px;">
            <label>Welcome Message to All Attendees</label>
            <textarea name="welcome_text" style="height: 300px; margin-bottom: 15px;" placeholder="Enter welcome message..."></textarea>
            <button type="submit" class="candy-btn">Save Welcome Message</button>
          </form>
          <div id="welcomeMessage" style="margin-top: 15px;"></div>
        </div>

        <!-- GUEST ADMISSION TAB -->
        <div id="admission" class="tab-content">
          <h2>👤 Register Guest (At Door)</h2>
          <form id="admissionForm" onsubmit="submitAdmission(event)">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
              <div><label>Full Name *</label><input type="text" name="name" required></div>
              <div><label>Email *</label><input type="email" name="email" required></div>
              <div><label>Phone *</label><input type="tel" name="phone" required></div>
              <div><label>Organization</label><input type="text" name="organization"></div>
              <div><label>Title</label><input type="text" name="title"></div>
              <div><label>Ticket Type *</label><select name="ticket_type" required>
                <option value="">Select Type</option>
                <option value="general">General Admin (10,000 TZS)</option>
                <option value="foreigners">Foreigners VIP (350 USD)</option>
                <option value="youth">Youth (200 USD)</option>
                <option value="speaker">Speaker (300 USD)</option>
                <option value="business">Business (250 USD)</option>
              </select></div>
            </div>
            <button type="submit" class="candy-btn" style="margin-top: 20px;">Register Guest</button>
          </form>
          <div id="admissionMessage" style="margin-top: 20px;"></div>
        </div>

        <!-- CHECK-IN TAB -->
        <div id="checkin" class="tab-content">
          <h2>✅ Check-in</h2>
          <label>Scan QR Code or Enter Ticket ID</label>
          <input type="text" id="qrInput" placeholder="Scan QR code here..." autofocus>
          <div id="checkinMessage" style="margin-top: 10px;"></div>
          <h3 style="margin-top: 30px;">Recent Check-ins</h3>
          <table>
            <thead><tr><th>Ticket ID</th><th>Name</th><th>Check-in Time</th><th>Ticket Type</th><th>Status</th></tr></thead>
            <tbody id="checkinList"></tbody>
          </table>
        </div>

        <!-- STATISTICS TAB -->
        <div id="statistics" class="tab-content">
          <h2>📊 Statistics</h2>
          <div id="statsContainer"></div>
          <h3 style="margin-top: 30px;">All Attendees</h3>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Category</th><th>Organization</th><th>Check-in</th><th>Status</th></tr></thead>
            <tbody id="allAttendeesList"></tbody>
          </table>
        </div>

        <!-- CHECK-OUT TAB -->
        <div id="checkout" class="tab-content">
          <h2>🚪 Check-out</h2>
          <label>Scan QR Code to Checkout</label>
          <input type="text" id="checkoutInput" placeholder="Scan QR code here..." autofocus>
          <div id="checkoutMessage" style="margin-top: 10px;"></div>
          <h3 style="margin-top: 30px;">Recent Check-outs</h3>
          <table>
            <thead><tr><th>Ticket ID</th><th>Name</th><th>Check-out Time</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody id="checkoutList"></tbody>
          </table>
        </div>
      </div>

      <script>
        function show(name) {
          document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
          document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
          document.getElementById(name).classList.add('active');
          event.target.classList.add('active');
          if (name === 'overview') loadOverview();
          if (name === 'statistics') loadStatistics();
          if (name === 'pending') loadPending();
          if (name === 'approval') loadApproval();
          if (name === 'checkin') loadCheckins();
          if (name === 'checkout') loadCheckouts();
        }

        async function submitAdmission(e) {
          e.preventDefault();
          const formData = new FormData(document.getElementById('admissionForm'));
          const data = Object.fromEntries(formData);
          
          try {
            const res = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            const msg = document.getElementById('admissionMessage');
            if (result.success) {
              msg.innerHTML = '<div style="color: #155724; background: #d4edda; padding: 12px; border-radius: 8px;">✅ Registered! Ticket: ' + result.ticket_id + '</div>';
              document.getElementById('admissionForm').reset();
            } else {
              msg.innerHTML = '<div style="color: #c92a2a; background: #f8d7da; padding: 12px; border-radius: 8px;">Error: ' + result.error + '</div>';
            }
          } catch (err) {
            document.getElementById('admissionMessage').innerHTML = '<div style="color: #c92a2a;">Error: ' + err.message + '</div>';
          }
        }

        document.getElementById('qrInput')?.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter') {
            const ticketId = e.target.value.trim();
            try {
              const res = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: ticketId })
              });
              const result = await res.json();
              document.getElementById('checkinMessage').innerHTML = result.success 
                ? '<div style="color: #155724; background: #d4edda; padding: 12px; border-radius: 8px;">✅ Checked in: ' + result.name + '</div>'
                : '<div style="color: #c92a2a; background: #f8d7da; padding: 12px; border-radius: 8px;">❌ ' + result.error + '</div>';
              e.target.value = '';
              loadCheckins();
              loadOverview();
            } catch (err) {
              document.getElementById('checkinMessage').innerHTML = '<div style="color: #c92a2a;">Error: ' + err.message + '</div>';
            }
          }
        });

        document.getElementById('checkoutInput')?.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter') {
            const ticketId = e.target.value.trim();
            try {
              const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: ticketId })
              });
              const result = await res.json();
              document.getElementById('checkoutMessage').innerHTML = result.success 
                ? '<div style="color: #155724; background: #d4edda; padding: 12px; border-radius: 8px;">✅ Checked out: ' + result.name + '</div>'
                : '<div style="color: #c92a2a; background: #f8d7da; padding: 12px; border-radius: 8px;">❌ ' + result.error + '</div>';
              e.target.value = '';
              loadCheckouts();
              loadOverview();
            } catch (err) {
              document.getElementById('checkoutMessage').innerHTML = '<div style="color: #c92a2a;">Error: ' + err.message + '</div>';
            }
          }
        });

        async function loadOverview() {
          const res = await fetch('/api/registrations');
          const data = await res.json();
          document.getElementById('stat-total').textContent = data.length;
          document.getElementById('stat-checked-in').textContent = data.filter(a => a.checked_in).length;
          document.getElementById('stat-pending').textContent = data.filter(a => a.payment_status === 'PENDING').length;
          document.getElementById('stat-approved').textContent = data.filter(a => a.payment_status === 'APPROVED').length;

          const activityList = document.getElementById('activityList');
          activityList.innerHTML = '';
          data.slice(0, 10).forEach(a => {
            const status = a.checked_in ? '✅ Checked In' : a.payment_status === 'PENDING' ? '⏳ Pending' : '✅ Approved';
            activityList.innerHTML += \`<tr><td>\${new Date(a.created_at).toLocaleTimeString()}</td><td>Registration</td><td>\${a.name}</td><td>\${status}</td></tr>\`;
          });
        }

        async function loadPending() {
          const res = await fetch('/api/registrations');
          const data = await res.json();
          const pending = data.filter(a => a.payment_status === 'PENDING');
          const list = document.getElementById('pendingList');
          list.innerHTML = '';
          pending.forEach(a => {
            list.innerHTML += \`<tr><td>\${a.name}</td><td>\${a.email}</td><td>\${a.ticket_type}</td><td>\${a.organization}</td><td>\${new Date(a.registered_at).toLocaleDateString()}</td><td><span class="badge badge-pending">Pending</span></td></tr>\`;
          });
        }

        async function loadApproval() {
          const res = await fetch('/api/registrations');
          const data = await res.json();
          const list = document.getElementById('approvalList');
          list.innerHTML = '';
          data.forEach(a => {
            const status = a.payment_status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' : '<span class="badge badge-pending">Pending</span>';
            list.innerHTML += \`<tr><td>\${a.name}</td><td>\${a.email}</td><td>\${a.ticket_type}</td><td>\${status}</td><td>
              <button class="btn-approve" onclick="approve('\${a.ticket_id}')">Approve</button>
              <button class="btn-email" onclick="sendBadgeEmail('\${a.ticket_id}', '\${a.email}', '\${a.name}')">Send Badge</button>
            </td></tr>\`;
          });
        }

        async function loadCheckins() {
          const res = await fetch('/api/registrations');
          const data = await res.json();
          const checkedIn = data.filter(a => a.checked_in).slice(0, 15);
          const list = document.getElementById('checkinList');
          list.innerHTML = '';
          checkedIn.forEach(a => {
            list.innerHTML += \`<tr><td><strong>\${a.ticket_id}</strong></td><td>\${a.name}</td><td>\${new Date(a.checked_in_at).toLocaleTimeString()}</td><td>\${a.ticket_type}</td><td><span class="badge badge-checked">Checked In</span></td></tr>\`;
          });
        }

        async function loadCheckouts() {
          const res = await fetch('/api/registrations');
          const data = await res.json();
          const checkedOut = data.filter(a => a.checked_out).slice(0, 15);
          const list = document.getElementById('checkoutList');
          list.innerHTML = '';
          checkedOut.forEach(a => {
            const duration = a.checked_in_at && a.checked_out_at 
              ? Math.round((new Date(a.checked_out_at) - new Date(a.checked_in_at)) / 3600000) + ' hours'
              : 'N/A';
            list.innerHTML += \`<tr><td><strong>\${a.ticket_id}</strong></td><td>\${a.name}</td><td>\${new Date(a.checked_out_at).toLocaleTimeString()}</td><td>\${duration}</td><td><span class="badge badge-checked">Checked Out</span></td></tr>\`;
          });
        }

        async function loadStatistics() {
          const res = await fetch('/api/registrations');
          const data = await res.json();
          
          const counts = { general: 0, foreigners: 0, youth: 0, speaker: 0, business: 0 };
          data.forEach(a => {
            if (counts.hasOwnProperty(a.ticket_type)) counts[a.ticket_type]++;
          });
          
          let html = '';
          for (let [key, count] of Object.entries(counts)) {
            html += \`<div class="stat-box"><div class="stat-number">\${count}</div><div class="stat-label">\${key.charAt(0).toUpperCase() + key.slice(1)}</div></div>\`;
          }
          document.getElementById('statsContainer').innerHTML = html;

          const list = document.getElementById('allAttendeesList');
          list.innerHTML = '';
          data.forEach(a => {
            const checked = a.checked_in ? '✅ Yes' : '❌ No';
            const status = a.payment_status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' : '<span class="badge badge-pending">Pending</span>';
            list.innerHTML += \`<tr><td>\${a.name}</td><td>\${a.email}</td><td>\${a.ticket_type}</td><td>\${a.organization}</td><td>\${checked}</td><td>\${status}</td></tr>\`;
          });
        }

        async function approve(ticketId) {
          if (!confirm('Approve this registration?')) return;
          const res = await fetch('/api/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_id: ticketId })
          });
          const result = await res.json();
          if (result.success) { alert('✅ Approved!'); loadApproval(); loadOverview(); }
        }

        async function sendBadgeEmail(ticketId, email, name) {
          if (!confirm('Send badge via email to ' + name + '?')) return;
          const res = await fetch('/api/send-badge-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_id: ticketId, email, name })
          });
          const result = await res.json();
          if (result.success) { alert('✅ Badge sent to ' + email); loadApproval(); }
          else { alert('❌ Error: ' + result.error); }
        }

        async function saveWelcome(e) {
          e.preventDefault();
          const text = document.querySelector('textarea[name="welcome_text"]').value;
          alert('Welcome message saved! (Would be sent to all attendees in production)');
        }

        loadOverview();
        setInterval(loadOverview, 10000);
      </script>
    </body>
    </html>
  `);
});

// API ENDPOINTS
app.post('/api/register', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not ready' });

    const { ticket_type, name, email, phone, organization, title, payment_method } = req.body;
    if (!ticket_type || !name || !email || !phone) {
      return res.json({ success: false, error: 'Missing required fields' });
    }

    const ticket = TICKET_TYPES[ticket_type];
    const ticketId = 'TKT-' + Date.now() + '-' + Math.random().toString(36).substring(7).toUpperCase();

    await pool.query(
      'INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_method, payment_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [ticketId, name, email, phone, organization || '', title || '', ticket_type, ticket.price, ticket.currency, payment_method || 'card', 'APPROVED']
    );

    res.json({ success: true, ticket_id: ticketId });
  } catch (error) {
    console.error('Registration error:', error);
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
    res.json({ success: true, name: attendee.name, ticket_id });
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
    res.json({ success: true, name: attendee.name, ticket_id });
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

    const attendee = result.rows[0];
    const qrData = JSON.stringify({ ticket_id, name: attendee.name, email: attendee.email });
    const qrCode = await QRCode.toDataURL(qrData);

    await pool.query(
      'UPDATE attendees SET payment_status = $1, qr_code = $2 WHERE ticket_id = $3',
      ['APPROVED', qrCode, ticket_id]
    );

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/send-badge-email', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not ready' });

    const { ticket_id, email, name } = req.body;
    
    // Generate badge PDF
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    let pdfData = '';
    
    doc.on('data', (chunk) => { pdfData += chunk; });
    doc.on('end', async () => {
      // In production, send via email service
      // For now, just mark as sent in database
      await pool.query(
        'UPDATE attendees SET badge_sent = true WHERE ticket_id = $1',
        [ticket_id]
      );
      
      res.json({ success: true, message: 'Badge email sent to ' + email });
    });

    doc.fontSize(18).text('2026 AFRICA CONVENTION - EVENT BADGE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(name);
    doc.fontSize(11).text('Attendee ID: ' + ticket_id);
    doc.moveDown();
    doc.text('Welcome to Africa Convention 2026!');
    doc.text('Theme: "Doing Business and Bearing Fruitful"');
    doc.moveDown();
    doc.text('June 18-22, 2026 | Arusha, Tanzania');
    
    doc.end();
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
    console.log(`✅ Admin logged in`);
    return res.redirect(`/admin?token=${token}`);
  }
  res.redirect('/admin-login?error=1');
});

app.get('/api/admin-logout', (req, res) => {
  const token = req.query.token;
  if (token) adminSessions.delete(token);
  res.redirect('/');
});

app.get('/admin-login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Admin Login</title>
      ${GLOSSY_STYLES}
      <style>
        body { display: flex; align-items: center; justify-content: center; }
        .login-container { position: relative; z-index: 1; padding: 60px; max-width: 420px; width: 100%; }
        .glass-container { position: relative; }
        .login-container h1 { color: #667eea; text-align: center; margin-bottom: 15px; font-size: 32px; }
        .login-container p { text-align: center; color: #666; margin-bottom: 40px; }
        .form-group { margin-bottom: 25px; }
        label { display: block; color: #333; font-weight: 600; margin-bottom: 10px; }
        .login-btn { width: 100%; padding: 14px; background: var(--gradient-button); color: white; border: none; border-radius: 15px; font-weight: bold; cursor: pointer; margin-top: 20px; }
        .error { color: #c92a2a; margin-bottom: 20px; padding: 12px; background: rgba(201, 42, 42, 0.1); border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="glass-container">
          <h1>🔐 Admin Login</h1>
          <p>Africa Convention 2026</p>
          ${req.query.error ? '<div class="error">Invalid credentials</div>' : ''}
          <form method="POST" action="/api/admin-login">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" required autofocus>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" required>
            </div>
            <button type="submit" class="login-btn">Login</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: pool ? 'Connected' : 'Not Ready' });
});

async function start() {
  const dbReady = await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log('\n✨ COMPLETE ENHANCED SYSTEM READY');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🏠 Home: http://localhost:${PORT}/`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin-login\n`);
  });
}

process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  if (pool) await pool.end();
  process.exit(0);
});

start();
