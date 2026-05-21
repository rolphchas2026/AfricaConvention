const fs = require('fs');
const path = require('path');

// --- INTERLINKING ENVIRONMENT SELECTION LAYER ---
const localEnvPath = path.join(__dirname, '.env.local');

if (fs.existsSync(localEnvPath) && (process.env.NODE_ENV === 'development' || !process.env.VERCEL)) {
  console.log('🔌 [SYSTEM ENGINE] Hooked successfully to Local Configuration: .env.local');
  require('dotenv').config({ path: localEnvPath });
} else {
  console.log('☁️ [SYSTEM ENGINE] Hooked to Production Cloud Configuration: Default Environment/.env');
  require('dotenv').config();
}

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Dynamic DB Handshake with SSL mapping check
// max: 5 keeps Vercel serverless within Supabase free-tier connection limits
let pool = null;
const dbConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
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
      ssl: false,
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

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Africa2026!';
const adminSessions = new Map();

function generateAdminToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function initializeDatabase() {
  console.log('🔧 Initializing database connection layer...');
  // Reduced retries for Vercel serverless (10s timeout budget)
  const maxRetries = process.env.VERCEL ? 5 : 30;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      pool = new Pool(dbConfig);
      const client = await pool.connect();
      console.log('✅ Database handshake executed successfully!');
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
      
      console.log('✅ Database dynamic storage schemas verified and ready');
      return true;
    } catch (error) {
      retries++;
      console.log(`⏳ Database unavailable. Retry ${retries}/${maxRetries} in 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Africa Convention 2026</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); min-height: 100vh; color: #333; }

    nav { background: rgba(255,255,255,0.95); padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px); animation: slideDown 0.6s ease-out; }
    @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    nav h1 { font-size: 28px; font-weight: 800; letter-spacing: 0.03em; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    nav a { padding: 12px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; transition: all 0.3s; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(102,126,234,0.3); }
    nav a:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102,126,234,0.5); }

    .hero { color: white; padding: 100px 40px; text-align: center; animation: fadeInUp 0.8s ease-out; }
    .hero h2 { font-size: 48px; font-weight: 800; margin-bottom: 20px; text-shadow: 0 4px 15px rgba(0,0,0,0.2); }
    .hero p { font-size: 20px; margin-bottom: 30px; opacity: 0.95; font-weight: 500; }

    .section { padding: 60px 40px; max-width: 1200px; margin: 0 auto; text-align: center; }
    .section h2 { font-size: 36px; margin-bottom: 10px; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .section p { font-size: 16px; margin-bottom: 40px; color: rgba(255,255,255,0.85); }
    
    .gallery-section { background: rgba(255, 255, 255, 0.95); border-radius: 24px; padding: 60px 40px; margin: 40px auto; box-shadow: 0 20px 50px rgba(0,0,0,0.15); }
    .gallery-section h2 { color: #333; text-shadow: none; }
    .gallery-section p { color: #666; }

    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; max-width: 1100px; margin: 0 auto; }
    .gallery-item { cursor: pointer; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.1); transition: all 0.35s; background: #fff; }
    .gallery-item:hover { transform: translateY(-10px); box-shadow: 0 18px 45px rgba(102,126,234,0.25); }
    .gallery-item img { width: 100%; height: 250px; object-fit: cover; display: block; }
    .gallery-caption { padding: 14px 16px 20px; font-size: 15px; font-weight: 700; color: #333; text-align: center; background: #fff; border-top: 1px solid #eee; }

    .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.85); align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background-color: white; padding: 20px; border-radius: 20px; position: relative; max-width: 90%; max-height: 90%; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .close-btn { position: absolute; top: 15px; right: 20px; font-size: 32px; font-weight: bold; cursor: pointer; color: #667eea; z-index: 1001; }
    .modal-image { width: 100%; max-width: 800px; border-radius: 15px; display: block; }

    .tickets { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto; }
    .ticket-card { background: white; padding: 35px 25px; border-radius: 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transition: all 0.3s; }
    .ticket-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.15); }
    .ticket-card h3 { font-size: 22px; color: #333; margin-bottom: 15px; }
    .ticket-card .price { font-size: 28px; font-weight: 800; color: #764ba2; margin-bottom: 15px; }
    .ticket-card button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.3s; }
    .ticket-card button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(102,126,234,0.4); }

    .registration-form { background: white; padding: 40px; border-radius: 24px; max-width: 650px; margin: 0 auto; box-shadow: 0 15px 40px rgba(0,0,0,0.15); text-align: left; }
    .form-group { margin-bottom: 22px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #444; font-size: 15px; }
    .form-group input, .form-group select { width: 100%; padding: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; transition: all 0.3s; color: #333; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 10px rgba(102,126,234,0.15); }
    .form-group button { width: 100%; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s; margin-top: 10px; }
    .form-group button:hover { box-shadow: 0 10px 25px rgba(102,126,234,0.4); transform: translateY(-1px); }

    .contact-section { background: rgba(255,255,255,0.95); border-radius: 24px; padding: 50px 40px; margin-top: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
    .contact-section h2 { color: #333; text-shadow: none; margin-bottom: 30px; }
    .contact-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 25px; }
    .contact-card { background: #f8fafc; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center; }
    .contact-card h3 { font-size: 18px; color: #4a5568; margin-bottom: 12px; }
    .contact-card p { color: #64748b; font-size: 15px; margin-bottom: 6px; font-weight: 500; }

    footer { text-align: center; padding: 40px; margin-top: 40px; color: rgba(255,255,255,0.8); font-weight: 500; }

    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 900px) {
      nav { padding: 18px 20px; }
      .hero h2 { font-size: 36px; }
      .section { padding: 40px 20px; }
    }
    @media (max-width: 600px) {
      nav { flex-direction: column; gap: 15px; text-align: center; }
      .registration-form { padding: 25px 20px; }
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

  <div class="section">
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
    <p>Select your tier to continue</p>
    <div class="tickets" id="ticketsContainer"></div>
  </div>

  <div class="section">
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

  <script>
    const galleryImages = ${JSON.stringify(getGalleryImages())};
    const gallery = document.getElementById('gallery');
    const ticketsContainer = document.getElementById('ticketsContainer');

    function formatImageTitle(filename) {
      return decodeURIComponent(filename)
        .replace(/\\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\\b\\w/g, (c) => c.toUpperCase());
    }

    function renderGallery() {
      if (!gallery) return;
      gallery.innerHTML = '';
      galleryImages.forEach((img, i) => {
        const title = formatImageTitle(img.split('/').pop());
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML =
          '<img src="' + img + '" alt="' + title + '" title="' + title + '">' +
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
          '<p style="margin: 0 0 18px; color: #666; font-size: 14px; line-height: 1.5;">' +
            'Includes access to convention sessions, networking, and event materials.' +
          '</p>' +
          '<button type="button" onclick="selectTicketType(\\'' + type + '\\')">Select</button>';
        ticketsContainer.appendChild(card);
      });
    }

    function selectTicketType(type) {
      const select = document.getElementById('ticketType');
      if (select) {
        select.value = type;
        select.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    async function registerAttendee() {
      const ticket_type = document.getElementById('ticketType').value;
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const organization = document.getElementById('organization').value.trim();
      const title = document.getElementById('title').value.trim();
      const msgDiv = document.getElementById('regMsg');

      if (!ticket_type || !name || !email || !phone) {
        msgDiv.innerHTML = '<div style="color: #c92a2a; background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-weight: 600;">⚠️ Please fill in all required fields.</div>';
        return;
      }

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_type, name, email, phone, organization, title })
        });
        const data = await res.json();
        if (data.success) {
          msgDiv.innerHTML = '<div style="color: #2b8a3e; background: #f4fce3; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-weight: 600;">🎉 Registration Complete! Ticket ID: ' + data.ticket_id + '</div>';
          document.getElementById('name').value = '';
          document.getElementById('email').value = '';
          document.getElementById('phone').value = '';
          document.getElementById('organization').value = '';
          document.getElementById('title').value = '';
          document.getElementById('ticketType').value = '';
        } else {
          msgDiv.innerHTML = '<div style="color: #c92a2a; background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 15px;">❌ Error: ' + data.error + '</div>';
        }
      } catch (err) {
        msgDiv.innerHTML = '<div style="color: #c92a2a; background: #fff5f5; padding: 12px; border-radius: 8px; margin-bottom: 15px;">❌ Network error occurred.</div>';
      }
    }

    renderGallery();
    renderTicketOptions();
  </script>
</body>
</html>
  `);
});

// ADMIN LOGIN TEMPLATE
app.get('/admin-login', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Admin Login</title>
  <style>
    body { font-family: sans-serif; background: #f1f5f9; padding: 50px; text-align: center; }
    .login { background: white; max-width: 400px; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 6px; }
    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .error { color: red; margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="login">
    <h1>Admin Login</h1>
    <p>Africa Convention 2026</p>
    \${req.query.error ? '<div class="error">Invalid credentials</div>' : ''}
    <form method=\"POST\" action=\"/api/admin-login\">
      <input type="text" name="username" placeholder="Username" required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  </div>
</body>
</html>
  `);
});

// Fallback listeners initialization

// ═══════════════════════════════════════════════════════════════════════════
//  CLIENT PREVIEW — public read-only live attendee board
// ═══════════════════════════════════════════════════════════════════════════
app.get('/preview', async (req, res) => {
  try {
    if (!pool) return res.status(503).send('<h2 style="padding:40px;font-family:sans-serif">Database initialising, try again in a moment.</h2>');
    const result = await pool.query('SELECT * FROM attendees ORDER BY created_at DESC');
    const attendees = result.rows;
    const total     = attendees.length;
    const approved  = attendees.filter(a => a.payment_status === 'APPROVED').length;
    const pending   = attendees.filter(a => a.payment_status === 'PENDING').length;
    const checkedIn = attendees.filter(a => a.checked_in).length;

    const rows = attendees.map(a => `
      <tr>
        <td><span class="tid">${a.ticket_id}</span></td>
        <td><strong>${a.name}</strong></td>
        <td>${a.organization || '—'}</td>
        <td><span class="badge type-${a.ticket_type}">${a.ticket_type}</span></td>
        <td>${a.ticket_price} ${a.currency}</td>
        <td><span class="status ${a.payment_status === 'APPROVED' ? 'approved' : 'pending'}">${a.payment_status}</span></td>
        <td>${a.checked_in ? '✅' : '—'}</td>
      </tr>`).join('');

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Africa Convention 2026 — Live Preview</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'DM Sans',sans-serif; background:#0f0f13; color:#e8e8f0; min-height:100vh; }
    header { background:linear-gradient(135deg,#667eea,#764ba2); padding:28px 48px; display:flex; justify-content:space-between; align-items:center; }
    header h1 { font-size:20px; font-weight:700; color:white; }
    header p  { font-size:13px; color:rgba(255,255,255,0.8); margin-top:4px; }
    header a  { background:rgba(255,255,255,0.2); color:white; text-decoration:none; padding:10px 20px; border-radius:20px; font-size:13px; font-weight:600; backdrop-filter:blur(10px); transition:all 0.2s; }
    header a:hover { background:rgba(255,255,255,0.35); }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:28px 48px 0; }
    .stat { background:#1a1a24; border:1px solid #2a2a3a; border-radius:14px; padding:22px; text-align:center; }
    .stat .n { font-size:38px; font-weight:700; background:linear-gradient(135deg,#667eea,#f093fb); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .stat .l { font-size:11px; color:#888; margin-top:6px; text-transform:uppercase; letter-spacing:1px; }
    .table-wrap { margin:28px 48px 48px; background:#1a1a24; border:1px solid #2a2a3a; border-radius:16px; overflow:hidden; }
    .table-header { padding:18px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #2a2a3a; }
    .table-header h2 { font-size:15px; font-weight:600; }
    .table-header span { font-size:12px; color:#667eea; background:rgba(102,126,234,0.12); padding:4px 12px; border-radius:20px; }
    table { width:100%; border-collapse:collapse; }
    th { padding:12px 18px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#666; border-bottom:1px solid #2a2a3a; }
    td { padding:14px 18px; font-size:14px; border-bottom:1px solid #1e1e2a; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:rgba(102,126,234,0.04); }
    .tid { font-family:monospace; font-size:12px; color:#667eea; background:rgba(102,126,234,0.1); padding:3px 8px; border-radius:6px; }
    .badge { padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; text-transform:uppercase; }
    .type-general    { background:rgba(102,126,234,0.15); color:#667eea; }
    .type-foreigners { background:rgba(240,147,251,0.15); color:#f093fb; }
    .type-youth      { background:rgba(132,250,176,0.15); color:#84fab0; }
    .type-speaker    { background:rgba(254,225,64,0.15);  color:#fee140; }
    .type-business   { background:rgba(248,181,0,0.15);   color:#f8b500; }
    .status { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; }
    .approved { background:rgba(132,250,176,0.15); color:#84fab0; }
    .pending  { background:rgba(250,112,154,0.15); color:#fa709a; }
    .empty    { text-align:center; padding:60px; color:#555; font-size:16px; }
    .refresh  { position:fixed; bottom:28px; right:28px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; padding:13px 22px; border-radius:30px; font-weight:700; cursor:pointer; box-shadow:0 8px 30px rgba(102,126,234,0.4); font-size:14px; font-family:'DM Sans',sans-serif; }
    .refresh:hover { transform:translateY(-2px); }
    @media(max-width:768px){.stats{grid-template-columns:repeat(2,1fr)}.table-wrap,.stats{margin-left:16px;margin-right:16px}header{padding:20px 16px;flex-direction:column;gap:12px;text-align:center}}
  </style>
</head>
<body>
  <header>
    <div><h1>🎪 Africa Convention 2026</h1><p>Live Attendee Database · Arusha, Tanzania · June 18-22</p></div>
    <a href="/">← Back to Site</a>
  </header>
  <div class="stats">
    <div class="stat"><div class="n">${total}</div><div class="l">Total Registered</div></div>
    <div class="stat"><div class="n">${approved}</div><div class="l">Approved</div></div>
    <div class="stat"><div class="n">${pending}</div><div class="l">Pending</div></div>
    <div class="stat"><div class="n">${checkedIn}</div><div class="l">Checked In</div></div>
  </div>
  <div class="table-wrap">
    <div class="table-header"><h2>All Attendees</h2><span>${total} records</span></div>
    <table>
      <thead><tr><th>Ticket ID</th><th>Name</th><th>Organization</th><th>Type</th><th>Price</th><th>Status</th><th>In</th></tr></thead>
      <tbody>${rows.length ? rows : '<tr><td colspan="7" class="empty">No attendees yet — register via the main page.</td></tr>'}</tbody>
    </table>
  </div>
  <button class="refresh" onclick="location.reload()">🔄 Refresh</button>
</body>
</html>`);
  } catch (err) {
    res.status(500).send(`<h2 style="padding:40px;color:red;font-family:sans-serif">Error: ${err.message}</h2>`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
app.get('/admin', (req, res) => {
  const token = req.query.token;
  if (!token || !adminSessions.has(token)) return res.redirect('/admin-login?error=1');

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Admin — Africa Convention 2026</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { height:100%; }
    body { font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background:linear-gradient(135deg,#f5f5f5,#e8e8f0); }
    .container { display:flex; flex-direction:column; height:100vh; }
    header { background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%); color:white; padding:20px 40px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; box-shadow:0 8px 32px rgba(102,126,234,0.3); }
    header h1 { font-size:24px; font-weight:700; }
    header a { color:white; padding:10px 22px; background:rgba(255,255,255,0.2); border-radius:25px; cursor:pointer; text-decoration:none; transition:all 0.3s; backdrop-filter:blur(10px); font-size:14px; }
    header a:hover { background:rgba(255,255,255,0.3); }
    .tabs-wrapper { display:flex; background:white; border-bottom:3px solid #667eea; overflow-x:auto; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
    .tab-btn { padding:15px 22px; background:white; border:none; cursor:pointer; font-size:13px; color:#666; border-bottom:4px solid transparent; white-space:nowrap; transition:all 0.3s; font-weight:500; }
    .tab-btn:hover { background:#f5f5f5; color:#667eea; }
    .tab-btn.active { color:#667eea; border-bottom-color:#667eea; font-weight:600; }
    .content-wrapper { flex:1; overflow-y:auto; padding:36px 40px; }
    .tab-content { display:none; animation:fadeInUp 0.35s ease-out; }
    .tab-content.active { display:block; }
    @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    .stat-box { background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:22px 28px; border-radius:14px; display:inline-block; margin:0 16px 16px 0; min-width:180px; text-align:center; box-shadow:0 8px 25px rgba(102,126,234,0.3); transition:all 0.3s; }
    .stat-box:hover { transform:translateY(-4px); }
    .stat-number { font-size:34px; font-weight:bold; }
    .stat-label  { font-size:12px; margin-top:8px; opacity:0.9; text-transform:uppercase; letter-spacing:0.5px; }
    table { width:100%; border-collapse:collapse; margin-top:16px; background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08); }
    th,td { padding:13px 15px; text-align:left; border-bottom:1px solid #f0f0f0; color:#333; font-size:14px; }
    th { background:linear-gradient(135deg,#667eea,#764ba2); color:white; font-weight:600; font-size:13px; }
    tr:hover td { background:#f9f9f9; }
    .badge { display:inline-block; padding:5px 11px; border-radius:12px; font-size:11px; font-weight:bold; }
    .badge-approved { background:linear-gradient(135deg,#84fab0,#8fd3f4); color:#155724; }
    .badge-pending  { background:linear-gradient(135deg,#fa709a,#fee140); color:#856404; }
    input[type=text] { padding:11px 14px; border:2px solid #ddd; border-radius:8px; font-size:14px; color:#333; transition:all 0.3s; }
    input[type=text]:focus { outline:none; border-color:#667eea; box-shadow:0 0 10px rgba(102,126,234,0.2); }
    button { padding:10px 18px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; transition:all 0.3s; }
    button:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(102,126,234,0.35); }
    h2 { color:#333; margin-bottom:18px; font-size:22px; }
    h3 { color:#667eea; margin:26px 0 12px; font-weight:600; }
    .info-msg { padding:13px 16px; margin-bottom:14px; border-radius:8px; font-weight:500; font-size:14px; }
    .info-msg.success { background:#d4edda; color:#155724; border-left:4px solid #28a745; }
    .info-msg.error   { background:#f8d7da; color:#c92a2a; border-left:4px solid #dc3545; }
    iframe { width:100%; height:680px; border:2px solid #ddd; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.08); }
    .preview-btn { display:inline-block; margin-bottom:18px; padding:10px 20px; background:linear-gradient(135deg,#11998e,#38ef7d); color:white; text-decoration:none; border-radius:20px; font-weight:600; font-size:13px; }
    .preview-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(17,153,142,0.35); }
    .btn-edit { padding:4px 10px; background:linear-gradient(135deg,#4facfe,#00f2fe); color:#003d5c; border:none; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700; margin-right:4px; transition:all 0.2s; }
    .btn-del  { padding:4px 10px; background:linear-gradient(135deg,#fa709a,#fee140); color:#7b1226; border:none; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700; transition:all 0.2s; }
    .btn-edit:hover,.btn-del:hover { transform:translateY(-1px); box-shadow:0 3px 10px rgba(0,0,0,0.2); }
    .modal-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); z-index:1000; align-items:center; justify-content:center; }
    .modal-overlay.open { display:flex; }
    .modal-box { background:white; border-radius:16px; padding:32px; width:540px; max-width:95vw; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3); animation:fadeInUp 0.25s ease-out; }
    .modal-box h3 { color:#667eea; margin-bottom:20px; font-size:18px; }
    .form-row { margin-bottom:14px; }
    .form-row label { display:block; font-size:12px; font-weight:700; color:#555; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.4px; }
    .form-row input,.form-row select { width:100%; padding:9px 12px; border:2px solid #e0e0e0; border-radius:8px; font-size:14px; color:#333; transition:border 0.2s; }
    .form-row input:focus,.form-row select:focus { outline:none; border-color:#667eea; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
    .modal-actions { display:flex; gap:10px; margin-top:22px; justify-content:flex-end; }
    .btn-cancel { padding:10px 18px; background:#f0f0f0; color:#555; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; }
    .btn-cancel:hover { background:#e0e0e0; transform:none; box-shadow:none; }
    .btn-save { padding:10px 22px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>🎪 Admin Dashboard</h1>
    <a onclick="logout()">Logout</a>
  </header>
  <div class="tabs-wrapper">
    <button class="tab-btn active" data-tab="academy">🎓 Academy</button>
    <button class="tab-btn" data-tab="overview">📊 Overview</button>
    <button class="tab-btn" data-tab="pending">⏳ Pending</button>
    <button class="tab-btn" data-tab="approval">✅ Approval</button>
    <button class="tab-btn" data-tab="checkin">📥 Check-in</button>
    <button class="tab-btn" data-tab="checkout">📤 Check-out</button>
    <button class="tab-btn" data-tab="statistics">📈 Statistics</button>
  </div>
  <div class="content-wrapper">

    <div id="academy" class="tab-content active">
      <h2>Academy</h2>
      <iframe src="/documentation/training.html" title="Training Materials"></iframe>
    </div>

    <div id="overview" class="tab-content">
      <h2>Overview</h2>
      <a class="preview-btn" href="/preview" target="_blank">📋 Open Client Preview →</a>
      <br>
      <div class="stat-box"><div class="stat-number" id="stat-total">—</div><div class="stat-label">Total</div></div>
      <div class="stat-box"><div class="stat-number" id="stat-approved">—</div><div class="stat-label">Approved</div></div>
      <div class="stat-box"><div class="stat-number" id="stat-checked">—</div><div class="stat-label">Checked In</div></div>
      <div class="stat-box"><div class="stat-number" id="stat-pending">—</div><div class="stat-label">Pending</div></div>
      <h3>All Registrations</h3>
      <table><thead><tr><th>Ticket ID</th><th>Name</th><th>Email</th><th>Type</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="overviewList"></tbody></table>
    </div>

    <div id="pending" class="tab-content">
      <h2>Pending Registrations</h2>
      <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Organization</th><th>Status</th></tr></thead>
      <tbody id="pendingList"></tbody></table>
    </div>

    <div id="approval" class="tab-content">
      <h2>Approval Queue</h2>
      <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
      <tbody id="approvalList"></tbody></table>
    </div>

    <div id="checkin" class="tab-content">
      <h2>Check-in</h2>
      <div style="margin-bottom:20px">
        <input type="text" id="checkinInput" placeholder="Scan or enter Ticket ID" style="max-width:340px">
        <div id="checkinMsg" style="margin-top:12px"></div>
      </div>
      <h3>Recent Check-ins</h3>
      <table><thead><tr><th>Ticket ID</th><th>Name</th><th>Time</th><th>Type</th><th>Status</th></tr></thead>
      <tbody id="checkinList"></tbody></table>
    </div>

    <div id="checkout" class="tab-content">
      <h2>Check-out</h2>
      <div style="margin-bottom:20px">
        <input type="text" id="checkoutInput" placeholder="Scan or enter Ticket ID" style="max-width:340px">
        <div id="checkoutMsg" style="margin-top:12px"></div>
      </div>
      <h3>Recent Check-outs</h3>
      <table><thead><tr><th>Ticket ID</th><th>Name</th><th>Time</th><th>Duration</th><th>Status</th></tr></thead>
      <tbody id="checkoutList"></tbody></table>
    </div>

    <div id="statistics" class="tab-content">
      <h2>Statistics</h2>
      <h3>By Ticket Type</h3>
      <div id="statsByType"></div>
      <h3>Full Attendee List</h3>
      <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Organization</th><th>Checked In</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="attendeesList"></tbody></table>
    </div>

  </div>
</div>

<div class="modal-overlay" id="editModal">
  <div class="modal-box">
    <h3>✏️ Edit Attendee</h3>
    <input type="hidden" id="editTicketId">
    <div class="form-grid">
      <div class="form-row" style="margin-bottom:0"><label>Name</label><input type="text" id="editName"></div>
      <div class="form-row" style="margin-bottom:0"><label>Email</label><input type="text" id="editEmail"></div>
    </div>
    <div class="form-grid">
      <div class="form-row" style="margin-bottom:0"><label>Phone</label><input type="text" id="editPhone"></div>
      <div class="form-row" style="margin-bottom:0"><label>Title</label><input type="text" id="editTitle"></div>
    </div>
    <div class="form-row"><label>Organization</label><input type="text" id="editOrganization"></div>
    <div class="form-grid">
      <div class="form-row" style="margin-bottom:0"><label>Ticket Type</label>
        <select id="editTicketType">
          <option value="general">General Admin (Local)</option>
          <option value="foreigners">Foreigners (VIP)</option>
          <option value="youth">Youth</option>
          <option value="speaker">Speaker</option>
          <option value="business">Business</option>
        </select>
      </div>
      <div class="form-row" style="margin-bottom:0"><label>Payment Status</label>
        <select id="editPaymentStatus">
          <option value="APPROVED">APPROVED</option>
          <option value="PENDING">PENDING</option>
        </select>
      </div>
    </div>
    <div class="form-row" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:14px;cursor:pointer">
        <input type="checkbox" id="editVerified" style="width:auto;margin:0"> Verified
      </label>
    </div>
    <div id="editError" style="color:#c92a2a;font-size:13px;min-height:18px"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeEdit()">Cancel</button>
      <button class="btn-save" onclick="saveEdit()">Save Changes</button>
    </div>
  </div>
</div>

<script>
  const token = new URLSearchParams(window.location.search).get('token');

  // Tab system
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tab).classList.add('active');
      this.classList.add('active');
      if (tab === 'overview')   loadOverview();
      if (tab === 'pending')    loadPending();
      if (tab === 'approval')   loadApproval();
      if (tab === 'statistics') loadStatistics();
      if (tab === 'checkin')    document.getElementById('checkinInput').focus();
      if (tab === 'checkout')   document.getElementById('checkoutInput').focus();
    });
  });

  let _allAttendees = [];
  async function fetchAttendees() {
    const res = await fetch('/api/registrations');
    _allAttendees = await res.json();
    return _allAttendees;
  }

  async function loadOverview() {
    try {
      const data = await fetchAttendees();
      document.getElementById('stat-total').textContent    = data.length;
      document.getElementById('stat-approved').textContent = data.filter(a => a.payment_status === 'APPROVED').length;
      document.getElementById('stat-checked').textContent  = data.filter(a => a.checked_in).length;
      document.getElementById('stat-pending').textContent  = data.filter(a => a.payment_status === 'PENDING').length;
      document.getElementById('overviewList').innerHTML = data.map(a =>
        '<tr><td><code style="font-size:12px;color:#667eea">' + a.ticket_id + '</code></td><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td>' + new Date(a.created_at).toLocaleDateString() + '</td><td><span class="badge ' + (a.payment_status==='APPROVED'?'badge-approved':'badge-pending') + '">' + a.payment_status + '</span></td>' +
        '<td><button class="btn-edit" onclick="editAttendee(\'' + a.ticket_id + '\')">✏️ Edit</button><button class="btn-del" onclick="deleteAttendee(\'' + a.ticket_id + '\')">🗑️</button></td></tr>'
      ).join('');
    } catch(e) { console.error(e); }
  }

  async function loadPending() {
    try {
      const data = await fetchAttendees();
      const pending = data.filter(a => a.payment_status === 'PENDING');
      document.getElementById('pendingList').innerHTML = pending.length
        ? pending.map(a => '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td>' + (a.organization||'—') + '</td><td><span class="badge badge-pending">Pending</span></td></tr>').join('')
        : '<tr><td colspan="5" style="text-align:center;color:#999;padding:30px">No pending registrations</td></tr>';
    } catch(e) { console.error(e); }
  }

  async function loadApproval() {
    try {
      const data = await fetchAttendees();
      document.getElementById('approvalList').innerHTML = data.map(a =>
        '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td><span class="badge ' + (a.payment_status==='APPROVED'?'badge-approved':'badge-pending') + '">' + a.payment_status + '</span></td><td><button onclick="approve(\'' + a.ticket_id + '\')">' + (a.payment_status==='APPROVED'?'Re-approve':'Approve') + '</button></td></tr>'
      ).join('');
    } catch(e) { console.error(e); }
  }

  async function loadStatistics() {
    try {
      const data = await fetchAttendees();
      const counts = { general:0, foreigners:0, youth:0, speaker:0, business:0 };
      data.forEach(a => { if (a.ticket_type in counts) counts[a.ticket_type]++; });
      document.getElementById('statsByType').innerHTML = Object.entries(counts)
        .map(([k,v]) => '<div class="stat-box"><div class="stat-number">' + v + '</div><div class="stat-label">' + k + '</div></div>').join('');
      document.getElementById('attendeesList').innerHTML = data.map(a =>
        '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + a.ticket_type + '</td><td>' + (a.organization||'—') + '</td><td>' + (a.checked_in?'✅ Yes':'—') + '</td><td><span class="badge ' + (a.payment_status==='APPROVED'?'badge-approved':'badge-pending') + '">' + a.payment_status + '</span></td>' +
        '<td><button class="btn-edit" onclick="editAttendee(\'' + a.ticket_id + '\')">✏️ Edit</button><button class="btn-del" onclick="deleteAttendee(\'' + a.ticket_id + '\')">🗑️</button></td></tr>'
      ).join('');
    } catch(e) { console.error(e); }
  }

  async function approve(tid) {
    if (!confirm('Approve ticket ' + tid + '?')) return;
    try {
      const res = await fetch('/api/approve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ticket_id: tid }) });
      const result = await res.json();
      if (result.success) { loadApproval(); loadOverview(); }
      else alert('Error: ' + result.error);
    } catch(e) { alert('Network error'); }
  }

  // Check-in handler
  document.getElementById('checkinInput').addEventListener('keypress', async e => {
    if (e.key !== 'Enter') return;
    const tid = e.target.value.trim(); if (!tid) return;
    try {
      const res = await fetch('/api/checkin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ticket_id: tid }) });
      const result = await res.json();
      const msg = document.getElementById('checkinMsg');
      msg.innerHTML = result.success
        ? '<div class="info-msg success">✅ ' + result.name + ' checked in successfully</div>'
        : '<div class="info-msg error">❌ ' + result.error + '</div>';
      e.target.value = '';
      setTimeout(loadOverview, 500);
    } catch(e) { document.getElementById('checkinMsg').innerHTML = '<div class="info-msg error">❌ Network error</div>'; }
  });

  // Check-out handler
  document.getElementById('checkoutInput').addEventListener('keypress', async e => {
    if (e.key !== 'Enter') return;
    const tid = e.target.value.trim(); if (!tid) return;
    try {
      const res = await fetch('/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ticket_id: tid }) });
      const result = await res.json();
      const msg = document.getElementById('checkoutMsg');
      msg.innerHTML = result.success
        ? '<div class="info-msg success">✅ ' + result.name + ' checked out successfully</div>'
        : '<div class="info-msg error">❌ ' + result.error + '</div>';
      e.target.value = '';
    } catch(e) { document.getElementById('checkoutMsg').innerHTML = '<div class="info-msg error">❌ Network error</div>'; }
  });

  function logout() { window.location.href = '/api/admin-logout?token=' + token; }

  function editAttendee(ticketId) {
    const a = _allAttendees.find(x => x.ticket_id === ticketId);
    if (!a) return;
    document.getElementById('editTicketId').value        = a.ticket_id;
    document.getElementById('editName').value            = a.name || '';
    document.getElementById('editEmail').value           = a.email || '';
    document.getElementById('editPhone').value           = a.phone || '';
    document.getElementById('editTitle').value           = a.title || '';
    document.getElementById('editOrganization').value    = a.organization || '';
    document.getElementById('editTicketType').value      = a.ticket_type || 'general';
    document.getElementById('editPaymentStatus').value   = a.payment_status || 'PENDING';
    document.getElementById('editVerified').checked      = !!a.verified;
    document.getElementById('editError').textContent     = '';
    document.getElementById('editModal').classList.add('open');
  }

  function closeEdit() {
    document.getElementById('editModal').classList.remove('open');
  }

  async function saveEdit() {
    const ticketId = document.getElementById('editTicketId').value;
    const body = {
      name:           document.getElementById('editName').value.trim(),
      email:          document.getElementById('editEmail').value.trim(),
      phone:          document.getElementById('editPhone').value.trim(),
      title:          document.getElementById('editTitle').value.trim(),
      organization:   document.getElementById('editOrganization').value.trim(),
      ticket_type:    document.getElementById('editTicketType').value,
      payment_status: document.getElementById('editPaymentStatus').value,
      verified:       document.getElementById('editVerified').checked
    };
    if (!body.name || !body.email) {
      document.getElementById('editError').textContent = 'Name and email are required.';
      return;
    }
    try {
      const res = await fetch('/api/attendees/' + encodeURIComponent(ticketId), {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.success) {
        closeEdit();
        loadOverview();
        if (document.getElementById('statistics').classList.contains('active')) loadStatistics();
      } else {
        document.getElementById('editError').textContent = result.error || 'Save failed.';
      }
    } catch(e) { document.getElementById('editError').textContent = 'Network error.'; }
  }

  async function deleteAttendee(ticketId) {
    const a = _allAttendees.find(x => x.ticket_id === ticketId);
    if (!confirm('Delete ' + (a ? a.name : ticketId) + '? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/attendees/' + encodeURIComponent(ticketId), { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { loadOverview(); }
      else alert('Error: ' + (result.error || 'Delete failed'));
    } catch(e) { alert('Network error'); }
  }

  // Close modal when clicking the overlay background
  document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEdit();
  });

  // Load overview on mount
  loadOverview();
</script>
</body>
</html>`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { ticket_type, name, email, phone, organization, title } = req.body;
    if (!ticket_type || !name || !email || !phone) return res.json({ success: false, error: 'Missing required fields' });
    const ticket = TICKET_TYPES[ticket_type];
    if (!ticket) return res.json({ success: false, error: 'Invalid ticket type' });
    const ticketId = 'TKT-' + ticket_type.toUpperCase().slice(0, 3) + '-' + Date.now();
    await pool.query(
      'INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [ticketId, name, email, phone, organization || '', title || '', ticket_type, ticket.price, ticket.currency, 'APPROVED']
    );
    res.json({ success: true, ticket_id: ticketId });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
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
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { ticket_id } = req.body;
    const result = await pool.query('SELECT * FROM attendees WHERE ticket_id = $1', [ticket_id]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Ticket not found' });
    const attendee = result.rows[0];
    if (!attendee.checked_in)  return res.json({ success: false, error: 'Not checked in yet' });
    if (attendee.checked_out)  return res.json({ success: false, error: 'Already checked out' });
    await pool.query('UPDATE attendees SET checked_out = true, checked_out_at = NOW() WHERE ticket_id = $1', [ticket_id]);
    res.json({ success: true, name: attendee.name });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/approve', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { ticket_id } = req.body;
    const result = await pool.query('SELECT * FROM attendees WHERE ticket_id = $1', [ticket_id]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Ticket not found' });
    const qrCode = await QRCode.toDataURL(JSON.stringify({ ticket_id, name: result.rows[0].name }));
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

app.put('/api/attendees/:ticket_id', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { ticket_id } = req.params;
    const { name, email, phone, organization, title, ticket_type, payment_status, verified } = req.body;
    if (!name || !email) return res.json({ success: false, error: 'Name and email required' });
    const result = await pool.query(
      'UPDATE attendees SET name=$1, email=$2, phone=$3, organization=$4, title=$5, ticket_type=$6, payment_status=$7, verified=$8 WHERE ticket_id=$9',
      [name, email, phone || '', organization || '', title || '', ticket_type, payment_status, !!verified, ticket_id]
    );
    if (result.rowCount === 0) return res.json({ success: false, error: 'Attendee not found' });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.delete('/api/attendees/:ticket_id', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { ticket_id } = req.params;
    const result = await pool.query('DELETE FROM attendees WHERE ticket_id = $1', [ticket_id]);
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: pool ? 'connected' : 'disconnected',
    env: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  STARTUP
// ═══════════════════════════════════════════════════════════════════════════
if (process.env.VERCEL) {
  // Serverless: fire-and-forget init, export app for Vercel to invoke
  initializeDatabase();
  module.exports = app;
} else {
  initializeDatabase().then((ready) => {
    if (ready) {
      app.listen(PORT, () => {
        console.log(`🚀 [SERVER RUNNING] Cluster alive on port: ${PORT}`);
        console.log(`📋 Preview:  http://localhost:${PORT}/preview`);
        console.log(`🔒 Admin:    http://localhost:${PORT}/admin-login`);
        console.log(`💊 Health:   http://localhost:${PORT}/api/health`);
      });
    } else {
      console.error('🛑 Core failure: Database could not initialize.');
      process.exit(1);
    }
  });
}
