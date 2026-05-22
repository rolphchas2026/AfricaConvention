const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

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

// Shared init promise — set in the Vercel startup block below.
// This middleware (registered before all routes) makes every request wait
// until the DB pool is ready on the first cold-start invocation.
let _initPromise = null;
app.use(async (req, res, next) => { if (!pool && _initPromise) await _initPromise; next(); });

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
const JWT_SECRET = process.env.JWT_SECRET || 'africa_conv_2026_jwt_x9z_secret_key';

function generateAdminToken() {
  const payload = Buffer.from(JSON.stringify({ u: ADMIN_USERNAME, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyAdminToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now();
  } catch { return false; }
}

function parseCookies(req) {
  const h = req.headers.cookie;
  if (!h) return {};
  return Object.fromEntries(h.split(';').map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
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
      
      // Add columns introduced after initial deploy (idempotent)
      await pool.query(`ALTER TABLE attendees ADD COLUMN IF NOT EXISTS payment_proof TEXT`);
      await pool.query(`ALTER TABLE attendees ADD COLUMN IF NOT EXISTS payment_proof_name VARCHAR(255)`);
      await pool.query(`ALTER TABLE attendees ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'`);

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

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

const TICKET_TYPE_COLORS = {
  general:    '#78909c',
  foreigners: '#e91e63',
  youth:      '#29b6f6',
  speaker:    '#ba68c8',
  business:   '#4fc3f7'
};

async function ensureQR(a) {
  if (a.qr_code) return a.qr_code;
  const qr = await QRCode.toDataURL(
    JSON.stringify({ ticket_id: a.ticket_id, name: a.name, type: a.ticket_type }),
    { width: 300, margin: 1 }
  );
  if (pool) await pool.query('UPDATE attendees SET qr_code=$1 WHERE ticket_id=$2', [qr, a.ticket_id]);
  a.qr_code = qr;
  return qr;
}

async function generateBadgePDF(a) {
  const qrDataURL = await ensureQR(a);
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A5', margin: 0 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 419, H = 595;
      const accent = TICKET_TYPE_COLORS[a.ticket_type] || '#f06292';

      // ── Background — light iOS blossom ────────────────────────────────────────
      doc.rect(0, 0, W, H).fill('#fdf8ff');

      // ── Header band — brochure image with soft blush tint overlay ─────────────
      const bronchourPath = path.join(__dirname, 'sysimages', 'bronchour.jpeg');
      try {
        if (fs.existsSync(bronchourPath)) {
          doc.save().rect(0, 0, W, 120).clip();
          doc.image(bronchourPath, 0, 0, { width: W });
          doc.restore();
          doc.save().fillOpacity(0.38).rect(0, 0, W, 120).fill('#1e293b').restore();
        } else {
          doc.rect(0, 0, W, 120).fill('#fce4ec');
        }
      } catch (_) {
        doc.rect(0, 0, W, 120).fill('#fce4ec');
      }

      // ── Accent stripe ─────────────────────────────────────────────────────────
      doc.rect(0, 120, W, 5).fill(accent);

      // ── Event title — white over image ────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(16).fillColor('white')
        .text('AFRICA CONVENTION 2026', 20, 18, { align: 'center', width: W - 40 });
      doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.9)')
        .text('Arusha, Tanzania  ·  June 18–22, 2026', 20, 42, { align: 'center', width: W - 40 });
      doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)')
        .text('Doing Business and Bearing Fruitful', 20, 60, { align: 'center', width: W - 40 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('white')
        .text('[ ' + (a.ticket_type || 'GENERAL').toUpperCase() + ' PASS ]', 20, 82, { align: 'center', width: W - 40 });

      // ── Delegate name ─────────────────────────────────────────────────────────
      const nameSize = a.name.length > 22 ? 20 : 26;
      doc.font('Helvetica-Bold').fontSize(nameSize).fillColor('#1e293b')
        .text(a.name, 20, 142, { align: 'center', width: W - 40 });

      let yPos = 142 + nameSize + 8;
      if (a.title) {
        doc.font('Helvetica').fontSize(12).fillColor('#64748b')
          .text(a.title, 20, yPos, { align: 'center', width: W - 40 });
        yPos += 18;
      }
      if (a.organization) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#e91e63')
          .text(a.organization, 20, yPos, { align: 'center', width: W - 40 });
        yPos += 18;
      }

      // ── QR Code — blush-bordered ──────────────────────────────────────────────
      const qrBuf = Buffer.from(qrDataURL.split(',')[1], 'base64');
      const qrSize = 148;
      const qrX = (W - qrSize) / 2;
      const qrY = Math.max(yPos + 18, 232);
      doc.roundedRect(qrX - 13, qrY - 13, qrSize + 26, qrSize + 26, 8).fill('#fce4ec');
      doc.rect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12).fill('white');
      doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

      // ── Ticket ID + label ─────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#e91e63')
        .text(a.ticket_id, 20, qrY + qrSize + 16, { align: 'center', width: W - 40 });
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
        .text('Scan to verify entry', 20, qrY + qrSize + 29, { align: 'center', width: W - 40 });

      // ── Info row ──────────────────────────────────────────────────────────────
      const infoY = H - 76;
      doc.moveTo(30, infoY - 6).lineTo(W - 30, infoY - 6)
        .strokeColor('#f8bbd0').lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#64748b')
        .text('✉ ' + a.email, 30, infoY, { width: W - 60 });
      if (a.phone) {
        doc.font('Helvetica').fontSize(8).fillColor('#64748b')
          .text('✆ ' + a.phone, 30, infoY + 13, { width: W - 60 });
      }

      // ── Footer — light blush band ─────────────────────────────────────────────
      doc.rect(0, H - 30, W, 30).fill('#fce4ec');
      doc.font('Helvetica').fontSize(7).fillColor('#64748b')
        .text('Africa Convention 2026  ·  WCCM Tanzania  ·  wccm.tz@gmail.com  ·  www.livinghope.or.tz',
          20, H - 19, { align: 'center', width: W - 40 });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────

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
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(160deg, #e8f4fd 0%, #fdf0f7 30%, #eef4ff 60%, #e8f5fd 100%); min-height: 100vh; color: #333; }

    nav { background: rgba(255,255,255,0.92); position: sticky; top: 0; z-index: 200; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(244,143,177,0.28); box-shadow: 0 4px 24px rgba(244,143,177,0.12); animation: slideDown 0.6s ease-out; }
    @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; height: 70px; }
    nav h1 { font-size: 21px; font-weight: 800; background: linear-gradient(135deg, #f06292, #ba68c8, #4fc3f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; white-space: nowrap; flex-shrink: 0; }
    .nav-links { display: flex; align-items: center; gap: 22px; }
    .nav-links a { color: #546e7a; text-decoration: none; font-size: 14px; font-weight: 600; transition: all 0.2s; padding: 4px 0; border-bottom: 2px solid transparent; }
    .nav-links a:hover { color: #e91e63; border-bottom-color: rgba(240,98,146,0.5); }
    .nav-links a.nav-admin { padding: 9px 22px; background: linear-gradient(135deg, #f48fb1, #ce93d8); color: white; border-radius: 25px; border-bottom: none; box-shadow: 0 4px 16px rgba(244,143,177,0.4); }
    .nav-links a.nav-admin:hover { transform: translateY(-2px); box-shadow: 0 8px 26px rgba(244,143,177,0.55); }
    .nav-toggle { display: none; background: none; border: none; color: #ba68c8; font-size: 26px; cursor: pointer; padding: 4px 6px; line-height: 1; }

    .hero { color: #1e293b; padding: 100px 40px 80px; text-align: center; animation: fadeInUp 0.8s ease-out; }
    .hero h2 { font-size: 48px; font-weight: 800; margin-bottom: 18px; background: linear-gradient(135deg, #e91e63, #ba68c8, #29b6f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.15; }
    .hero p { font-size: 20px; margin-bottom: 36px; opacity: 0.9; font-weight: 500; color: #64748b; }
    .hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .hero-cta { padding: 14px 36px; background: linear-gradient(135deg, #f48fb1, #ce93d8); color: white; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 30px rgba(244,143,177,0.45); transition: all 0.3s; }
    .hero-cta:hover { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(244,143,177,0.6); }
    .hero-cta-outline { padding: 14px 36px; background: rgba(255,255,255,0.78); color: #e91e63; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 16px; border: 2px solid rgba(244,143,177,0.45); backdrop-filter: blur(8px); transition: all 0.3s; }
    .hero-cta-outline:hover { background: rgba(255,255,255,0.95); border-color: rgba(240,98,146,0.65); transform: translateY(-3px); }

    .section { padding: 60px 40px; max-width: 1200px; margin: 0 auto; text-align: center; }
    .section h2 { font-size: 36px; margin-bottom: 10px; color: #1e293b; text-shadow: none; }
    .section p { font-size: 16px; margin-bottom: 40px; color: #64748b; }
    
    .gallery-section { position:relative; overflow:hidden; border-radius:32px; padding:80px 40px; margin:40px auto; background:linear-gradient(135deg,#fce4ec 0%,#e8eaf6 25%,#e3f2fd 55%,#fce4ec 80%,#e8eaf6 100%); box-shadow:0 0 0 1px rgba(244,143,177,0.22),0 25px 60px rgba(244,143,177,0.18),0 0 80px rgba(129,212,250,0.12); }
    .orb { position:absolute; border-radius:50%; pointer-events:none; filter:blur(55px); opacity:0.28; animation:orbFloat 8s ease-in-out infinite; }
    .orb-1 { width:320px; height:320px; background:radial-gradient(circle,rgba(244,143,177,0.95),transparent 70%); top:-70px; left:-50px; animation-duration:9s; }
    .orb-2 { width:380px; height:380px; background:radial-gradient(circle,rgba(186,104,200,0.85),transparent 70%); bottom:-90px; right:-60px; animation-duration:11s; animation-delay:-3s; }
    .orb-3 { width:220px; height:220px; background:radial-gradient(circle,rgba(129,212,250,0.8),transparent 70%); top:45%; left:35%; animation-duration:7s; animation-delay:-5s; }
    .orb-4 { width:180px; height:180px; background:radial-gradient(circle,rgba(240,98,146,0.8),transparent 70%); top:15%; right:12%; animation-duration:10s; animation-delay:-2s; }
    .orb-5 { width:140px; height:140px; background:radial-gradient(circle,rgba(79,195,247,0.85),transparent 70%); bottom:18%; left:18%; animation-duration:8s; animation-delay:-4s; }
    @keyframes orbFloat { 0%,100%{transform:translate(0,0) scale(1);opacity:0.28} 33%{transform:translate(18px,-22px) scale(1.09);opacity:0.38} 66%{transform:translate(-12px,14px) scale(0.94);opacity:0.16} }
    .gallery-heading { position:relative; z-index:1; text-align:center; margin-bottom:48px; }
    .gallery-heading h2 { font-size:44px; font-weight:800; color:#1e293b; text-shadow:0 0 30px rgba(244,143,177,0.5),0 2px 8px rgba(0,0,0,0.06); letter-spacing:0.02em; animation:glowPulse 3s ease-in-out infinite; margin-bottom:0; }
    .gallery-heading p { font-size:17px; color:#64748b; text-shadow:none; margin-top:12px; margin-bottom:0; }
    @keyframes glowPulse { 0%,100%{text-shadow:0 0 30px rgba(244,143,177,0.5),0 2px 8px rgba(0,0,0,0.06)} 50%{text-shadow:0 0 55px rgba(244,143,177,0.75),0 0 80px rgba(186,104,200,0.35),0 2px 8px rgba(0,0,0,0.06)} }
    /* ── Landing CoverFlow ─────────────────────────────────────── */
    .cf-stage { position:relative; z-index:1; height:360px; perspective:1400px; perspective-origin:50% 50%; display:flex; align-items:center; justify-content:center; overflow:visible; }
    .cf-card { position:absolute; width:220px; height:280px; border-radius:18px; overflow:hidden; cursor:pointer; will-change:transform,opacity; transition:transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.6s ease,box-shadow 0.6s ease; }
    .cf-card img { width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }
    .cf-card .cf-gloss { position:absolute; inset:0; background:linear-gradient(145deg,rgba(255,255,255,0.25) 0%,transparent 52%); border-radius:18px; pointer-events:none; }
    .cf-card.pos-center { transform:translateX(0) translateZ(130px) rotateY(0deg) scale(1.42); z-index:10; opacity:1; box-shadow:0 55px 130px rgba(244,143,177,0.72),0 0 0 2px rgba(255,255,255,0.85),0 0 80px rgba(186,104,200,0.28); -webkit-box-reflect:below 8px linear-gradient(transparent 44%,rgba(244,143,177,0.36) 68%,rgba(186,104,200,0.22)); }
    .cf-card.pos-left1  { transform:translateX(-265px) translateZ(0) rotateY(54deg); z-index:7; opacity:0.72; box-shadow:0 14px 40px rgba(244,143,177,0.25); }
    .cf-card.pos-left2  { transform:translateX(-465px) translateZ(-120px) rotateY(66deg); z-index:5; opacity:0.32; }
    .cf-card.pos-right1 { transform:translateX(265px) translateZ(0) rotateY(-54deg); z-index:7; opacity:0.72; box-shadow:0 14px 40px rgba(244,143,177,0.25); }
    .cf-card.pos-right2 { transform:translateX(465px) translateZ(-120px) rotateY(-66deg); z-index:5; opacity:0.32; }
    .cf-card.pos-hidden { opacity:0; transform:translateX(0) scale(0.2); pointer-events:none; z-index:1; transition:none; }
    .cf-shelf { position:relative; z-index:1; height:1px; background:linear-gradient(90deg,transparent 0%,rgba(244,143,177,0.38) 25%,rgba(244,143,177,0.38) 75%,transparent 100%); margin:0 60px; }
    .cf-controls { position:relative; z-index:1; display:flex; align-items:center; justify-content:center; gap:14px; padding:22px 0 16px; }
    .cf-arrow { background:rgba(255,255,255,0.78); border:1px solid rgba(244,143,177,0.42); color:#e91e63; width:38px; height:38px; border-radius:50%; font-size:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; padding:0; flex-shrink:0; backdrop-filter:blur(10px); transform:none !important; box-shadow:none !important; }
    .cf-arrow:hover { background:rgba(255,255,255,0.97); box-shadow:0 4px 16px rgba(244,143,177,0.32) !important; transform:none !important; }
    /* Filmstrip */
    .cf-film { position:relative; z-index:1; display:flex; gap:8px; justify-content:flex-start; overflow-x:auto; padding:14px 20px; background:rgba(255,255,255,0.42); backdrop-filter:blur(14px); border-radius:16px; margin-top:14px; scrollbar-width:none; -ms-overflow-style:none; }
    .cf-film::-webkit-scrollbar { display:none; }
    .cf-thumb { width:58px; height:72px; border-radius:10px; overflow:hidden; cursor:pointer; opacity:0.45; transition:all 0.3s; flex-shrink:0; border:2px solid transparent; touch-action:manipulation; }
    .cf-thumb.active { opacity:1; border-color:#f48fb1; box-shadow:0 4px 16px rgba(244,143,177,0.45); transform:scale(1.08); }
    .cf-thumb img { width:100%; height:100%; object-fit:cover; pointer-events:none; display:block; }
    @media(max-width:600px){ .cf-stage{height:300px} .cf-card{width:170px;height:215px} .cf-card.pos-center{transform:translateX(0) translateZ(80px) rotateY(0deg) scale(1.38)} .cf-card.pos-left1{transform:translateX(-210px) translateZ(0) rotateY(54deg)} .cf-card.pos-right1{transform:translateX(210px) translateZ(0) rotateY(-54deg)} .cf-card.pos-left2,.cf-card.pos-right2{opacity:0;pointer-events:none} .cf-film{gap:6px;padding:10px 14px} .cf-thumb{width:48px;height:60px} }

    .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.85); align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background-color: white; padding: 20px; border-radius: 20px; position: relative; max-width: 90%; max-height: 90%; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .close-btn { position: absolute; top: 15px; right: 20px; font-size: 32px; font-weight: bold; cursor: pointer; color: #667eea; z-index: 1001; }
    .modal-image { width: 100%; max-width: 800px; border-radius: 15px; display: block; }

    .tickets { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto; }
    .ticket-card { background: white; padding: 35px 25px; border-radius: 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transition: all 0.3s; }
    .ticket-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.15); }
    .ticket-card h3 { font-size: 22px; color: #333; margin-bottom: 15px; }
    .ticket-card .price { font-size: 28px; font-weight: 800; color: #e91e63; margin-bottom: 15px; }
    .ticket-card button { width: 100%; padding: 14px; background: linear-gradient(135deg, #f48fb1 0%, #ce93d8 100%); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.3s; }
    .ticket-card button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(244,143,177,0.45); }

    .registration-form { background: white; padding: 40px; border-radius: 24px; max-width: 650px; margin: 0 auto; box-shadow: 0 15px 40px rgba(0,0,0,0.15); text-align: left; }
    .form-group { margin-bottom: 22px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #444; font-size: 15px; }
    .form-group input, .form-group select { width: 100%; padding: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; transition: all 0.3s; color: #333; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 10px rgba(102,126,234,0.15); }
    .form-group button { width: 100%; padding: 16px; background: linear-gradient(135deg, #f48fb1 0%, #ce93d8 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s; margin-top: 10px; }
    .form-group button:hover { box-shadow: 0 10px 25px rgba(244,143,177,0.45); transform: translateY(-1px); }

    .contact-section { background: rgba(255,255,255,0.95); border-radius: 24px; padding: 50px 40px; margin-top: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
    .contact-section h2 { color: #333; text-shadow: none; margin-bottom: 30px; }
    .contact-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 25px; }
    .contact-card { background: #f8fafc; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center; }
    .contact-card h3 { font-size: 18px; color: #4a5568; margin-bottom: 12px; }
    .contact-card p { color: #64748b; font-size: 15px; margin-bottom: 6px; font-weight: 500; }

    footer { background: rgba(255,255,255,0.88); backdrop-filter: blur(20px); border-top: 1px solid rgba(244,143,177,0.22); padding: 60px 40px 32px; margin-top: 60px; }
    .footer-inner { max-width: 1200px; margin: 0 auto; }
    .footer-top { display: grid; grid-template-columns: 1fr 2fr; gap: 60px; margin-bottom: 48px; }
    .footer-brand h3 { font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #f06292, #ba68c8, #4fc3f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; }
    .footer-brand p { color: #64748b; font-size: 14px; line-height: 1.75; }
    .footer-sponsors h4 { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 22px; }
    .sponsor-grid { display: flex; flex-wrap: wrap; gap: 16px; }
    .sponsor-slot { display: flex; flex-direction: column; align-items: center; gap: 9px; text-decoration: none; transition: all 0.3s; }
    .sponsor-logo-ph { width: 110px; height: 62px; background: rgba(255,255,255,0.85); border: 1px dashed rgba(244,143,177,0.4); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: rgba(240,98,146,0.45); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; transition: all 0.3s; }
    .sponsor-slot:hover .sponsor-logo-ph { background: rgba(244,143,177,0.1); border-color: rgba(240,98,146,0.5); color: rgba(233,30,99,0.75); }
    .sponsor-slot span { font-size: 11px; color: #94a3b8; transition: color 0.3s; }
    .sponsor-slot:hover span { color: #e91e63; }
    .footer-bottom { border-top: 1px solid rgba(244,143,177,0.15); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .footer-bottom p { font-size: 13px; color: #94a3b8; }
    .footer-bottom a { color: #ba68c8; text-decoration: none; transition: color 0.2s; }
    .footer-bottom a:hover { color: #e91e63; }
    @media(max-width:768px){ .footer-top { grid-template-columns:1fr; gap:36px; } .footer-bottom { flex-direction:column; text-align:center; } footer { padding:48px 24px 28px; } }

    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 1024px) {
      .nav-inner { padding: 0 24px; }
      .hero h2 { font-size: 40px; }
    }
    @media (max-width: 768px) {
      .nav-toggle { display: block; }
      .nav-links { display: none; flex-direction: column; align-items: stretch; gap: 4px; position: absolute; top: 70px; left: 0; right: 0; background: rgba(255,255,255,0.97); border-bottom: 1px solid rgba(244,143,177,0.22); padding: 16px 24px 24px; z-index: 199; }
      .nav-links.open { display: flex; }
      .nav-links a { padding: 12px 0; border-bottom: 1px solid rgba(244,143,177,0.12); }
      .nav-links a.nav-admin { text-align: center; border-bottom: none; margin-top: 8px; }
      .hero { padding: 70px 24px 60px; }
      .hero h2 { font-size: 34px; }
      .hero p { font-size: 17px; }
      .section { padding: 40px 20px; }
      .registration-form { padding: 28px 20px; }
      .tickets { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      nav h1 { font-size: 17px; }
      .hero h2 { font-size: 28px; }
      .hero-cta, .hero-cta-outline { padding: 13px 26px; font-size: 15px; }
      .gallery-heading h2 { font-size: 32px; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <h1>🎪 Africa Convention 2026</h1>
      <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">☰</button>
      <div class="nav-links">
        <a href="#register">Register</a>
        <a href="#tickets">Tickets</a>
        <a href="#contact">Contact</a>
        <a href="/admin-login" class="nav-admin">Admin Login</a>
      </div>
    </div>
  </nav>

  <div class="hero">
    <h2>Doing Business and Bearing Fruitful</h2>
    <p>June 18–22, 2026 · Arusha, Tanzania</p>
    <div class="hero-btns">
      <a href="#register" class="hero-cta">Register Now</a>
      <a href="#tickets" class="hero-cta-outline">View Tickets</a>
    </div>
  </div>
    
  <div class="gallery-section">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>
    <div class="orb orb-5"></div>
    <div class="gallery-heading">
      <h2>Event Gallery</h2>
      <p>Experience the Africa Convention 2026</p>
    </div>
    <div class="cf-stage" id="cfStage"></div>
    <div class="cf-shelf"></div>
    <div class="cf-controls">
      <button class="cf-arrow" onclick="cfPrev()">&#8249;</button>
      <button class="cf-arrow" onclick="cfNext()">&#8250;</button>
    </div>
    <div class="cf-film" id="cfFilm"></div>
  </div>

  <div class="section" id="register">
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

  <div class="section" id="tickets">
    <h2>Ticket Options</h2>
    <p>Select your tier to continue</p>
    <div class="tickets" id="ticketsContainer"></div>
  </div>

  <div class="section" id="contact">
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
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-brand">
          <h3>🎪 Africa Convention 2026</h3>
          <p>Doing Business and Bearing Fruitful<br>June 18–22, 2026 · Arusha, Tanzania<br><br>📞 +255 787 576 900 &nbsp;|&nbsp; +255 713 276 655<br>✉️ wccm.tz@gmail.com</p>
        </div>
        <div class="footer-sponsors">
          <h4>Our Sponsors &amp; Partners</h4>
          <div class="sponsor-grid">
            <a href="#" class="sponsor-slot"><div class="sponsor-logo-ph">LOGO</div><span>Sponsor One</span></a>
            <a href="#" class="sponsor-slot"><div class="sponsor-logo-ph">LOGO</div><span>Sponsor Two</span></a>
            <a href="#" class="sponsor-slot"><div class="sponsor-logo-ph">LOGO</div><span>Sponsor Three</span></a>
            <a href="#" class="sponsor-slot"><div class="sponsor-logo-ph">LOGO</div><span>Sponsor Four</span></a>
            <a href="#" class="sponsor-slot"><div class="sponsor-logo-ph">LOGO</div><span>Sponsor Five</span></a>
            <a href="#" class="sponsor-slot"><div class="sponsor-logo-ph">LOGO</div><span>Sponsor Six</span></a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Africa Convention · WCCM Tanzania. All rights reserved.</p>
        <p><a href="http://www.livinghope.or.tz" target="_blank" rel="noopener">www.livinghope.or.tz</a></p>
      </div>
    </div>
  </footer>

  <div id="modal" class="modal">
    <div class="modal-content">
      <span class="close-btn" onclick="closeGallery()">&times;</span>
      <img id="modalImage" class="modal-image" src="" alt="">
    </div>
  </div>

  <script>
    const galleryImages = ${JSON.stringify(getGalleryImages())};
    const ticketsContainer = document.getElementById('ticketsContainer');

    // ── CoverFlow + Filmstrip ──────────────────────────────────────
    let _cfActive = 0, _cfTimer = null;
    const CF_INTERVAL = 4200;

    function initCoverflow() {
      const stage = document.getElementById('cfStage');
      const filmEl = document.getElementById('cfFilm');
      if (!stage) return;
      if (!galleryImages.length) {
        stage.innerHTML = '<p style="color:#94a3b8;padding:80px 20px;text-align:center;font-size:15px;position:relative;z-index:1">Gallery coming soon — photos will appear here.</p>';
        return;
      }
      galleryImages.forEach(function(src, i) {
        const card = document.createElement('div');
        card.className = 'cf-card pos-hidden';
        card.dataset.idx = i;
        card.innerHTML = '<img src="' + src + '" alt=""><div class="cf-gloss"></div>';
        card.addEventListener('click', function() {
          const idx = parseInt(this.dataset.idx);
          if (idx === _cfActive) { openGallery(idx); }
          else { cfGoTo(idx); }
        });
        stage.appendChild(card);
        const thumb = document.createElement('div');
        thumb.className = 'cf-thumb';
        thumb.dataset.idx = i;
        thumb.innerHTML = '<img src="' + src + '" alt="">';
        thumb.addEventListener('click', (function(idx){ return function(){ cfGoTo(idx); }; })(i));
        filmEl.appendChild(thumb);
      });
      cfRender();
      cfStartAuto();
      stage.addEventListener('mouseenter', cfStopAuto);
      stage.addEventListener('mouseleave', cfStartAuto);
      // Swipe gestures on stage
      let _swX = null, _swY = null;
      stage.addEventListener('touchstart', function(e) {
        _swX = e.touches[0].clientX;
        _swY = e.touches[0].clientY;
        cfStopAuto();
      }, {passive:true});
      stage.addEventListener('touchend', function(e) {
        if (_swX === null) return;
        const dx = e.changedTouches[0].clientX - _swX;
        const dy = e.changedTouches[0].clientY - _swY;
        _swX = null; _swY = null;
        if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return;
        if (dx < 0) cfNext(); else cfPrev();
        cfStartAuto();
      }, {passive:true});
    }

    function cfRender() {
      const n = galleryImages.length;
      if (!n) return;
      document.querySelectorAll('.cf-card').forEach(function(card, i) {
        const raw = (i - _cfActive % n + n) % n;
        const d = raw > n / 2 ? raw - n : raw;
        card.className = 'cf-card ' + ({'-2':'pos-left2','-1':'pos-left1','0':'pos-center','1':'pos-right1','2':'pos-right2'}[String(d)] || 'pos-hidden');
      });
      document.querySelectorAll('.cf-thumb').forEach(function(thumb, i) {
        const active = i === (_cfActive % n);
        thumb.classList.toggle('active', active);
        if (active) { try { thumb.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); } catch(e){} }
      });
    }

    function cfGoTo(i) { _cfActive = ((i % galleryImages.length) + galleryImages.length) % galleryImages.length; cfRender(); }
    function cfNext() { cfGoTo(_cfActive + 1); }
    function cfPrev() { cfGoTo(_cfActive - 1); }
    function cfStartAuto() { cfStopAuto(); if (galleryImages.length > 1) _cfTimer = setInterval(cfNext, CF_INTERVAL); }
    function cfStopAuto() { if (_cfTimer) { clearInterval(_cfTimer); _cfTimer = null; } }

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

    initCoverflow();
    renderTicketOptions();
  </script>
  <footer style="text-align:center;padding:12px 20px;font-style:italic;font-size:7px;color:#94a3b8;border-top:1px solid rgba(244,143,177,0.15);background:rgba(255,255,255,0.6);backdrop-filter:blur(8px);margin-top:0">© Faith&amp;Will Logi-Tec Solutions &nbsp;·&nbsp; Designed by LEAD ICT ENG. RAPHAEL CHARLES MSESI &nbsp;·&nbsp; raphayelchas@gmail.com &nbsp;·&nbsp; +255 743 868 755 &nbsp;·&nbsp; All Rights Reserved</footer>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Africa Convention 2026</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e8f4fd 0%,#fdf0f7 30%,#eef4ff 60%,#e8f6fd 100%);position:relative;overflow:hidden}
    .orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(60px);opacity:0.3;animation:orbFloat 9s ease-in-out infinite}
    .o1{width:380px;height:380px;background:radial-gradient(circle,rgba(244,143,177,0.9),transparent 70%);top:-90px;left:-70px;animation-duration:10s}
    .o2{width:420px;height:420px;background:radial-gradient(circle,rgba(186,104,200,0.85),transparent 70%);bottom:-110px;right:-80px;animation-duration:13s;animation-delay:-4s}
    .o3{width:220px;height:220px;background:radial-gradient(circle,rgba(129,212,250,0.8),transparent 70%);top:38%;right:8%;animation-duration:8s;animation-delay:-2s}
    .o4{width:160px;height:160px;background:radial-gradient(circle,rgba(79,195,247,0.8),transparent 70%);bottom:20%;left:8%;animation-duration:11s;animation-delay:-6s}
    @keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1);opacity:0.3}33%{transform:translate(20px,-26px) scale(1.1);opacity:0.4}66%{transform:translate(-14px,16px) scale(0.93);opacity:0.18}}
    .card{position:relative;z-index:1;background:rgba(255,255,255,0.88);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);border:1px solid rgba(244,143,177,0.28);border-radius:28px;padding:52px 46px;width:430px;max-width:92vw;box-shadow:0 0 0 1px rgba(244,143,177,0.1),0 32px 75px rgba(244,143,177,0.18),0 0 60px rgba(129,212,250,0.1)}
    .logo{text-align:center;margin-bottom:34px}
    .logo h1{font-size:26px;font-weight:800;background:linear-gradient(135deg,#f06292,#ba68c8,#4fc3f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:9px;line-height:1.2}
    .logo p{font-size:13px;color:#94a3b8;letter-spacing:0.4px}
    h2{font-size:17px;color:#374151;font-weight:700;margin-bottom:26px;text-align:center}
    .err{background:rgba(254,226,226,0.9);border:1px solid rgba(252,165,165,0.5);border-radius:10px;padding:12px 16px;margin-bottom:20px;color:#ef4444;font-size:14px;text-align:center}
    label{display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
    input[type=text],input[type=password]{width:100%;padding:14px 16px;background:rgba(255,255,255,0.95);border:1px solid rgba(244,143,177,0.35);border-radius:12px;font-size:15px;color:#374151;margin-bottom:20px;transition:all 0.25s;outline:none;font-family:inherit}
    input::placeholder{color:#94a3b8}
    input:focus{border-color:rgba(240,98,146,0.6);background:#fff;box-shadow:0 0 0 3px rgba(244,143,177,0.2)}
    .btn{width:100%;padding:15px;background:linear-gradient(135deg,#f48fb1 0%,#ce93d8 100%);color:white;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.3s;box-shadow:0 8px 32px rgba(244,143,177,0.4);font-family:inherit}
    .btn:hover{transform:translateY(-2px);box-shadow:0 14px 42px rgba(244,143,177,0.55)}
    .back{display:block;text-align:center;margin-top:24px;color:#94a3b8;font-size:13px;text-decoration:none;transition:color 0.2s}
    .back:hover{color:#e91e63}
    @media(max-width:480px){.card{padding:36px 24px}}
  </style>
</head>
<body>
  <div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="orb o4"></div>
  <div class="card">
    <div class="logo">
      <h1>🎪 Africa Convention</h1>
      <p>Arusha, Tanzania · June 18–22, 2026</p>
    </div>
    <h2>Admin Access</h2>
    ${req.query.error ? '<div class="err">⚠️ Invalid credentials — please try again</div>' : ''}
    <form method="POST" action="/api/admin-login">
      <label>Username</label>
      <input type="text" name="username" placeholder="Enter username" required autocomplete="username">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter password" required autocomplete="current-password">
      <button type="submit" class="btn">Sign In →</button>
    </form>
    <a class="back" href="/">← Back to main site</a>
    <p style="text-align:center;margin-top:22px;font-style:italic;font-size:7px;color:#94a3b8">© Faith&amp;Will Logi-Tec Solutions &nbsp;·&nbsp; LEAD ICT ENG. RAPHAEL CHARLES MSESI &nbsp;·&nbsp; raphayelchas@gmail.com &nbsp;·&nbsp; +255 743 868 755 &nbsp;·&nbsp; All Rights Reserved</p>
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
    body { font-family:'DM Sans',sans-serif; background:linear-gradient(160deg,#e8f4fd 0%,#fdf0f7 50%,#eef4ff 100%); color:#374151; min-height:100vh; }
    header { background:linear-gradient(135deg,#fce4ec 0%,#e8eaf6 40%,#e3f2fd 80%,#e0f7fa 100%); padding:24px 48px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 8px 40px rgba(244,143,177,0.2); }
    header h1 { font-size:20px; font-weight:800; color:#1e293b; }
    header p  { font-size:13px; color:#64748b; margin-top:4px; }
    header a  { background:rgba(255,255,255,0.78); color:#e91e63; text-decoration:none; padding:10px 20px; border-radius:20px; font-size:13px; font-weight:600; backdrop-filter:blur(10px); transition:all 0.2s; border:1px solid rgba(244,143,177,0.35); }
    header a:hover { background:rgba(255,255,255,0.98); }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:28px 48px 0; }
    .stat { background:rgba(255,255,255,0.88); border:1px solid rgba(244,143,177,0.22); border-radius:14px; padding:22px; text-align:center; }
    .stat .n { font-size:38px; font-weight:800; background:linear-gradient(135deg,#f06292,#ce93d8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .stat .l { font-size:11px; color:#94a3b8; margin-top:6px; text-transform:uppercase; letter-spacing:1px; }
    .table-wrap { margin:28px 48px 48px; background:rgba(255,255,255,0.92); border:1px solid rgba(244,143,177,0.18); border-radius:16px; overflow:hidden; }
    .table-header { padding:18px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(244,143,177,0.18); }
    .table-header h2 { font-size:15px; font-weight:700; color:#1e293b; }
    .table-header span { font-size:12px; color:#e91e63; background:rgba(244,143,177,0.12); padding:4px 12px; border-radius:20px; border:1px solid rgba(244,143,177,0.25); }
    table { width:100%; border-collapse:collapse; }
    th { padding:12px 18px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; border-bottom:1px solid rgba(244,143,177,0.15); }
    td { padding:13px 18px; font-size:14px; border-bottom:1px solid rgba(244,143,177,0.08); color:#374151; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:rgba(244,143,177,0.05); }
    .tid { font-family:monospace; font-size:12px; color:#e91e63; background:rgba(244,143,177,0.12); padding:3px 8px; border-radius:6px; }
    .badge { padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; }
    .type-general    { background:rgba(186,104,200,0.15); color:#8e24aa; }
    .type-foreigners { background:rgba(244,143,177,0.18); color:#e91e63; }
    .type-youth      { background:rgba(129,212,250,0.18); color:#0288d1; }
    .type-speaker    { background:rgba(253,186,116,0.18); color:#ea580c; }
    .type-business   { background:rgba(167,243,208,0.2);  color:#059669; }
    .status { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; }
    .approved { background:rgba(167,243,208,0.25); color:#059669; }
    .pending  { background:rgba(254,202,202,0.3);  color:#e11d48; }
    .empty    { text-align:center; padding:60px; color:#94a3b8; font-size:16px; }
    .refresh  { position:fixed; bottom:28px; right:28px; background:linear-gradient(135deg,#f48fb1,#ce93d8); color:white; border:none; padding:13px 22px; border-radius:30px; font-weight:700; cursor:pointer; box-shadow:0 8px 30px rgba(244,143,177,0.45); font-size:14px; font-family:'DM Sans',sans-serif; }
    .refresh:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(244,143,177,0.55); }
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
  <footer style="text-align:center;padding:10px 20px;font-style:italic;font-size:7px;color:#94a3b8;border-top:1px solid rgba(244,143,177,0.12);margin-top:12px">© Faith&amp;Will Logi-Tec Solutions &nbsp;·&nbsp; Designed by LEAD ICT ENG. RAPHAEL CHARLES MSESI &nbsp;·&nbsp; raphayelchas@gmail.com &nbsp;·&nbsp; +255 743 868 755 &nbsp;·&nbsp; All Rights Reserved</footer>
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
  const token = req.query.token || parseCookies(req).admin_token;
  if (!verifyAdminToken(token)) return res.redirect('/admin-login?error=1');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
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
    const qrCode = await QRCode.toDataURL(
      JSON.stringify({ ticket_id: ticketId, name, type: ticket_type }), { width: 300, margin: 1 }
    );
    await pool.query(
      'INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status, qr_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [ticketId, name, email, phone, organization || '', title || '', ticket_type, ticket.price, ticket.currency, 'APPROVED', qrCode]
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

app.post('/api/revoke-checkout', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { ticket_id } = req.body;
    const result = await pool.query('SELECT * FROM attendees WHERE ticket_id = $1', [ticket_id]);
    if (result.rows.length === 0) return res.json({ success: false, error: 'Ticket not found' });
    const attendee = result.rows[0];
    if (!attendee.checked_out) return res.json({ success: false, error: 'Not checked out' });
    await pool.query('UPDATE attendees SET checked_out = false, checked_out_at = NULL WHERE ticket_id = $1', [ticket_id]);
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
    const qrCode = await ensureQR(result.rows[0]);
    await pool.query('UPDATE attendees SET payment_status=$1, qr_code=$2 WHERE ticket_id=$3', ['APPROVED', qrCode, ticket_id]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/registrations', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not connected — check DATABASE_URL in Vercel env vars' });
    const result = await pool.query('SELECT * FROM attendees ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const tok = generateAdminToken();
    res.cookie('admin_token', tok, {
      httpOnly: true,
      secure: !!process.env.VERCEL,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.redirect('/admin');
  }
  res.redirect('/admin-login?error=1');
});

app.get('/api/admin-logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/admin-login');
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

// ── F-1: Payment proof ────────────────────────────────────────────────────────

app.post('/api/attendees/:ticket_id/payment', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { data, name, mimeType } = req.body;
    if (!data || !name) return res.json({ success: false, error: 'File data and name required' });
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) return res.json({ success: false, error: 'Only PDF, JPG, PNG allowed' });
    await pool.query(
      'UPDATE attendees SET payment_proof=$1, payment_proof_name=$2 WHERE ticket_id=$3',
      [data, name, req.params.ticket_id]
    );
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/attendees/:ticket_id/payment', async (req, res) => {
  try {
    if (!pool) return res.status(503).send('DB not ready');
    const r = await pool.query('SELECT payment_proof, payment_proof_name FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    if (!r.rows[0]?.payment_proof) return res.status(404).json({ error: 'No payment proof' });
    const { payment_proof, payment_proof_name } = r.rows[0];
    const mimeMatch = payment_proof.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const buf = Buffer.from(payment_proof.replace(/^data:[^;]+;base64,/, ''), 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline; filename="' + (payment_proof_name || 'payment') + '"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/attendees/:ticket_id/payment', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    await pool.query('UPDATE attendees SET payment_proof=NULL, payment_proof_name=NULL WHERE ticket_id=$1', [req.params.ticket_id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── F-2: Document folder ──────────────────────────────────────────────────────

app.get('/api/attendees/:ticket_id/documents', async (req, res) => {
  try {
    if (!pool) return res.json([]);
    const r = await pool.query('SELECT documents FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    const docs = (r.rows[0]?.documents || []).map((d, i) => ({ index: i, name: d.name, uploadedAt: d.uploadedAt, size: d.size }));
    res.json(docs);
  } catch (e) { res.json([]); }
});

app.post('/api/attendees/:ticket_id/documents', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const { data, name, mimeType } = req.body;
    if (!data || !name) return res.json({ success: false, error: 'File data and name required' });
    const r = await pool.query('SELECT documents FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    if (!r.rows[0]) return res.json({ success: false, error: 'Attendee not found' });
    const docs = r.rows[0].documents || [];
    const sizeKB = Math.round(Buffer.byteLength(data, 'utf8') / 1024);
    docs.push({ name, mimeType, data, uploadedAt: new Date().toISOString(), size: sizeKB + ' KB' });
    await pool.query('UPDATE attendees SET documents=$1 WHERE ticket_id=$2', [JSON.stringify(docs), req.params.ticket_id]);
    res.json({ success: true, count: docs.length });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/attendees/:ticket_id/documents/:idx', async (req, res) => {
  try {
    if (!pool) return res.status(503).send('DB not ready');
    const r = await pool.query('SELECT documents FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    const docs = r.rows[0]?.documents || [];
    const doc = docs[parseInt(req.params.idx)];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const buf = Buffer.from(doc.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const mime = doc.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline; filename="' + doc.name + '"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/attendees/:ticket_id/documents/:idx', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    const r = await pool.query('SELECT documents FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    const docs = r.rows[0]?.documents || [];
    docs.splice(parseInt(req.params.idx), 1);
    await pool.query('UPDATE attendees SET documents=$1 WHERE ticket_id=$2', [JSON.stringify(docs), req.params.ticket_id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── P2-A: Badge PDF ───────────────────────────────────────────────────────────

app.get('/api/badge/:ticket_id', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not ready' });
    const r = await pool.query('SELECT * FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Attendee not found' });
    const a = r.rows[0];
    const pdfBuf = await generateBadgePDF(a);
    await pool.query('UPDATE attendees SET badge_generated=true WHERE ticket_id=$1', [a.ticket_id]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="badge-' + a.ticket_id + '.pdf"');
    res.send(pdfBuf);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Inline preview (opens in browser)
app.get('/api/badge/:ticket_id/preview', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Database not ready' });
    const r = await pool.query('SELECT * FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Attendee not found' });
    const pdfBuf = await generateBadgePDF(r.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="badge-' + req.params.ticket_id + '.pdf"');
    res.send(pdfBuf);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── P2-C: SMTP email with badge attachment ────────────────────────────────────

app.post('/api/send-badge/:ticket_id', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'Database not ready' });
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.json({ success: false, error: 'SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel env)' });
    }
    const r = await pool.query('SELECT * FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    if (!r.rows[0]) return res.json({ success: false, error: 'Attendee not found' });
    const a = r.rows[0];

    const pdfBuf = await generateBadgePDF(a);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const typeLabel = { general:'General Admin', foreigners:'Foreigner (VIP)', youth:'Youth', speaker:'Speaker', business:'Business' }[a.ticket_type] || a.ticket_type;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Africa Convention 2026" <' + process.env.SMTP_USER + '>',
      to: a.email,
      subject: 'Your Africa Convention 2026 Badge — ' + a.name,
      html: `
      <div style="font-family:sans-serif;background:#12002a;padding:40px 20px;min-height:100vh">
        <div style="max-width:560px;margin:0 auto;background:rgba(255,255,255,0.05);border:1px solid rgba(196,77,255,0.25);border-radius:20px;padding:40px;color:white">
          <h1 style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#ff80f0,#c44dff,#ff4da6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 4px">🎪 Africa Convention 2026</h1>
          <p style="color:rgba(200,160,255,0.65);font-size:13px;margin:0 0 28px">Arusha, Tanzania · June 18–22, 2026</p>
          <p style="color:rgba(240,220,255,0.9);font-size:16px;margin:0 0 14px">Dear <strong>${a.name}</strong>,</p>
          <p style="color:rgba(210,180,255,0.8);line-height:1.7;margin:0 0 24px">Your convention badge is attached to this email as a PDF. Please present it at the entrance — printed or on your device — for check-in.</p>
          <div style="background:rgba(196,77,255,0.1);border:1px solid rgba(196,77,255,0.25);border-radius:12px;padding:20px;margin-bottom:28px">
            <p style="margin:0 0 8px;color:rgba(255,220,255,0.9)"><strong>Ticket ID:</strong> ${a.ticket_id}</p>
            <p style="margin:0 0 8px;color:rgba(255,220,255,0.9)"><strong>Pass Type:</strong> ${typeLabel}</p>
            ${a.organization ? '<p style="margin:0;color:rgba(255,220,255,0.9)"><strong>Organisation:</strong> ' + a.organization + '</p>' : ''}
          </div>
          <p style="color:rgba(180,130,220,0.5);font-size:12px;text-align:center;margin:0">Africa Convention 2026 · WCCM Tanzania · wccm.tz@gmail.com</p>
        </div>
      </div>`,
      attachments: [{ filename: 'badge-' + a.ticket_id + '.pdf', content: pdfBuf, contentType: 'application/pdf' }]
    });

    await pool.query('UPDATE attendees SET badge_sent=true, badge_generated=true WHERE ticket_id=$1', [a.ticket_id]);
    res.json({ success: true, sent_to: a.email });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  let count = null, dbErr = null, dbUser = null;
  if (pool) {
    try {
      const r = await pool.query('SELECT COUNT(*) FROM attendees');
      count = parseInt(r.rows[0].count, 10);
      const u = await pool.query('SELECT current_user, current_database()');
      dbUser = u.rows[0];
    } catch(e) { dbErr = e.message; }
  }
  res.json({
    status: 'ok',
    db: pool ? 'connected' : 'disconnected',
    attendee_count: count,
    db_user: dbUser,
    db_error: dbErr,
    env: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  STARTUP
// ═══════════════════════════════════════════════════════════════════════════
if (process.env.VERCEL) {
  // Serverless: store the init promise so the early middleware can await it.
  _initPromise = initializeDatabase();
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
