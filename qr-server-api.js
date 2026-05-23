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

      // Raffle tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS raffle_votes (
          id SERIAL PRIMARY KEY,
          voter_ticket_id VARCHAR(255) UNIQUE NOT NULL,
          nominee_ticket_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS raffle_settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          voting_open BOOLEAN DEFAULT false,
          reveal_ready BOOLEAN DEFAULT false
        )
      `);
      await pool.query(`INSERT INTO raffle_settings (id, voting_open, reveal_ready) VALUES (1, false, false) ON CONFLICT (id) DO NOTHING`);

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
      doc.rect(0, H - 40, W, 40).fill('#fce4ec');
      doc.font('Helvetica').fontSize(7).fillColor('#64748b')
        .text('Africa Convention 2026  \xB7  WCCM Tanzania  \xB7  wccm.tz@gmail.com  \xB7  www.livinghope.or.tz',
          20, H - 29, { align: 'center', width: W - 40 });
      doc.font('Helvetica').fontSize(6).fillColor('#94a3b8')
        .text('\xA9 Faith&Will Logi-Tec Solutions  \xB7  Designed by LEAD ICT ENG. RAPHAEL CHARLES MSESI  \xB7  raphayelchas@gmail.com  \xB7  +255 743 868 755',
          20, H - 17, { align: 'center', width: W - 40 });

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
  <link rel="icon" type="image/svg+xml" href="/sysimages/favicon.svg">
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
    .sponsor-slot { display: flex; flex-direction: column; align-items: center; gap: 9px; text-decoration: none; transition: all 0.3s; position: relative; }
    .sponsor-logo-ph { width: 110px; height: 62px; background: rgba(255,255,255,0.85); border: 1px solid rgba(244,143,177,0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: rgba(240,98,146,0.45); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; transition: all 0.35s; overflow: hidden; position: relative; }
    .sponsor-logo-ph img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; display: block; transition: opacity 0.35s, transform 0.35s; }
    .sponsor-logo-ph::after { content: 'Follow →'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(233,30,99,0.82); color: white; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 10px; opacity: 0; transition: opacity 0.35s; font-family: inherit; }
    .sponsor-slot:hover .sponsor-logo-ph { border-color: #f06292; box-shadow: 0 8px 28px rgba(244,143,177,0.45); transform: translateY(-4px) scale(1.04); }
    .sponsor-slot:hover .sponsor-logo-ph img { opacity: 0.25; transform: scale(1.08); }
    .sponsor-slot:hover .sponsor-logo-ph::after { opacity: 1; }
    .sponsor-slot span { font-size: 11px; color: #94a3b8; transition: color 0.3s; }
    .sponsor-slot:hover span { color: #e91e63; font-weight: 700; }
    .sponsor-tooltip { position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%) translateY(4px); background: #1e293b; color: white; font-size: 11px; font-weight: 600; padding: 6px 13px; border-radius: 8px; white-space: nowrap; opacity: 0; pointer-events: none; transition: all 0.25s; box-shadow: 0 4px 14px rgba(0,0,0,0.25); }
    .sponsor-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: #1e293b; }
    .sponsor-slot:hover .sponsor-tooltip { opacity: 1; transform: translateX(-50%) translateY(0); }
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

    /* packages pricing cards */
    .pkg-tier-live { display: inline-flex; align-items: center; gap: 10px; padding: 10px 24px; border-radius: 30px; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 18px; }
    .pkg-countdown { display: inline-block; background: rgba(30,41,59,0.08); border-radius: 20px; padding: 8px 22px; font-size: 13px; font-weight: 700; color: #475569; margin-top: 10px; }
    .pkg-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 22px; max-width: 1200px; margin: 0 auto; }
    .pkg-card { background: white; border-radius: 20px; box-shadow: 0 8px 28px rgba(0,0,0,0.1); overflow: hidden; transition: box-shadow 0.3s, transform 0.3s; }
    .pkg-card.featured { box-shadow: 0 12px 40px rgba(233,30,99,0.18); }
    .pkg-card:hover { transform: translateY(-4px); box-shadow: 0 18px 45px rgba(0,0,0,0.16); }
    .pkg-card:nth-child(1), .pkg-card:nth-child(2), .pkg-card:nth-child(3) { grid-column: span 2; }
    .pkg-card:nth-child(4), .pkg-card:nth-child(5) { grid-column: span 3; }
    .pkg-card-head { padding: 26px 24px 20px; cursor: pointer; }
    .pkg-card-icon { font-size: 32px; margin-bottom: 10px; }
    .pkg-card-name { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
    .pkg-card-price-tag { font-size: 30px; font-weight: 900; margin-bottom: 6px; }
    .pkg-card-tier-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
    .pkg-card-cta-text { font-size: 12px; color: #64748b; line-height: 1.55; margin-bottom: 14px; }
    .pkg-card-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #e91e63; border: none; background: none; cursor: pointer; padding: 0; }
    .pkg-detail { display: none; padding: 0 24px 24px; }
    .pkg-card.open .pkg-detail { display: block; border-top: 1px solid #f1f5f9; }
    .pkg-detail-intro { font-size: 13px; color: #475569; line-height: 1.6; padding: 14px 0; }
    .pkg-tier-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    .pkg-tier-table th { background: #f8fafc; color: #64748b; font-weight: 700; padding: 8px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pkg-tier-table th:first-child { text-align: left; }
    .pkg-tier-table td { padding: 8px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 12px; }
    .pkg-tier-table td:first-child { text-align: left; font-weight: 600; color: #374151; }
    .pkg-tier-row-current td { background: rgba(233,30,99,0.05); }
    .pkg-tier-row-expired td { opacity: 0.4; }
    .pkg-breakdown { background: #f8fafc; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px; }
    .pkg-breakdown-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
    .pkg-breakdown-row.total { font-weight: 900; color: #1e293b; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; font-size: 15px; }
    .pkg-book-btn { width: 100%; padding: 15px; border: none; border-radius: 12px; font-size: 14px; font-weight: 800; cursor: pointer; transition: all 0.3s; }
    .pkg-book-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(233,30,99,0.35); }
    @media (max-width: 1023px) { .pkg-grid { grid-template-columns: repeat(2,1fr); } .pkg-card:nth-child(n) { grid-column: span 1; } }
    @media (max-width: 639px) { .pkg-grid { grid-template-columns: 1fr; } }
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
        <a href="#packages">Packages</a>
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
      <a href="#packages" class="hero-cta-outline">View Packages</a>
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
      <div id="pkgSelectedBanner" style="display:none;background:linear-gradient(135deg,#fce4ec,#f3e8ff);border:1.5px solid #f06292;border-radius:12px;padding:14px 18px;margin-bottom:16px;font-size:14px;color:#7c3aed;font-weight:600;justify-content:space-between;align-items:flex-start;gap:12px"><span id="pkgBannerText"></span><button onclick="document.getElementById('pkgSelectedBanner').style.display='none'" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:#94a3b8;font-size:20px;line-height:1;padding:0">&#215;</button></div>
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

  <div class="section" id="packages">
    <div style="text-align:center;margin-bottom:44px">
      <div class="pkg-tier-live" id="pkgTierBadge" style="background:#dcfce7;color:#16a34a">&#11044; LIVE TIER: D &middot; Early Bird &nbsp;&middot;&nbsp; 40% off hotel accommodation</div>
      <h2>Convention Accommodation Packages</h2>
      <p>5 nights &middot; Arusha hotel &middot; All convention services included &middot; Early-bird savings on accommodation (Option B)</p>
      <div class="pkg-countdown" id="pkgCountdown">Calculating tier deadline&hellip;</div>
    </div>
    <div class="pkg-grid" id="pkgGrid"></div>
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
            <a href="https://malikale.com" target="_blank" rel="noopener" class="sponsor-slot">
              <div class="sponsor-tooltip">Follow Malikale · malikale.com</div>
              <div class="sponsor-logo-ph"><img src="/sysimages/sponsors/httpsmalikale_com.png" alt="Malikale"></div>
              <span>Malikale</span>
            </a>
            <a href="https://www.newsafarihotel.com" target="_blank" rel="noopener" class="sponsor-slot">
              <div class="sponsor-tooltip">Follow New Safari Hotel · newsafarihotel.com</div>
              <div class="sponsor-logo-ph"><img src="/sysimages/sponsors/httpsnewsafarihotel_com-tanzania_com_en.png" alt="New Safari Hotel"></div>
              <span>New Safari Hotel</span>
            </a>
            <a href="https://sabrahmsafaris.com" target="_blank" rel="noopener" class="sponsor-slot">
              <div class="sponsor-tooltip">Follow Sabrahm Safaris · sabrahmsafaris.com</div>
              <div class="sponsor-logo-ph"><img src="/sysimages/sponsors/httpssabrahmsafaris_com.png" alt="Sabrahm Safaris"></div>
              <span>Sabrahm Safaris</span>
            </a>
            <a href="https://www.rwandair.com" target="_blank" rel="noopener" class="sponsor-slot">
              <div class="sponsor-tooltip">Follow RwandAir · rwandair.com</div>
              <div class="sponsor-logo-ph"><img src="/sysimages/sponsors/rwand_air.png" alt="RwandAir"></div>
              <span>RwandAir</span>
            </a>
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
        const formEl = document.getElementById('register');
        if (formEl) {
          const rect = formEl.getBoundingClientRect();
          if (rect.top > window.innerHeight || rect.bottom < 0) {
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
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

    // ── Packages / Pricing Cards ────────────────────────────────────
    var PKG_TIERS = [
      { label: 'D · Early Bird',   dates: 'May 23 – May 29', end: new Date('2026-05-30'), disc: 0.40, color: '#16a34a', bg: '#dcfce7', urgency: 'Deepest saving — 40% off your hotel accommodation. This rate expires May 29. Book now to lock the largest discount available.' },
      { label: 'C · Standard',     dates: 'May 30 – Jun 4',  end: new Date('2026-06-05'), disc: 0.30, color: '#0284c7', bg: '#dbeafe', urgency: 'Save 30% on accommodation — this tier closes June 4. Secure your room rate before the price steps up.' },
      { label: 'B · Advantage',    dates: 'Jun 5 – Jun 10',  end: new Date('2026-06-11'), disc: 0.20, color: '#d97706', bg: '#fef3c7', urgency: 'Final 20% saving window — only days remain before rates rise permanently. Reserve your place while this tier is open.' },
      { label: 'A · Last Chance',  dates: 'Jun 11 – Jun 16', end: new Date('2026-06-17'), disc: 0.10, color: '#dc2626', bg: '#fee2e2', urgency: 'Last-chance discount — 10% off hotel. This is your final opportunity to receive any saving before walk-in pricing takes effect.' },
      { label: 'Full Rate',             dates: 'Jun 17+',              end: null,                   disc: 0,    color: '#64748b', bg: '#f1f5f9', urgency: 'Early-booking windows are closed. Register now to secure your convention place at the standard rate.' }
    ];
    var PKG_EMOJI = { 'Ordinary Single': '🛏️', 'Double Single': '🏨', 'Triple Single': '🛒️', 'Suite Single VVIP': '👑', 'Double Suite': '🏖️' };
    var PKGS = [
      { name: 'Ordinary Single',   accom: 475  },
      { name: 'Double Single',     accom: 625  },
      { name: 'Triple Single',     accom: 750  },
      { name: 'Suite Single VVIP', accom: 1750, featured: true },
      { name: 'Double Suite',      accom: 1150 }
    ];
    function optB(accom, disc) { return Math.round(accom * (1 - disc)) + 240; }
    function pkgCurrentTier() {
      var now = new Date();
      for (var i = 0; i < PKG_TIERS.length - 1; i++) { if (now < PKG_TIERS[i].end) return i; }
      return PKG_TIERS.length - 1;
    }
    function renderPkgCards() {
      var ti = pkgCurrentTier();
      var tier = PKG_TIERS[ti];
      var grid = document.getElementById('pkgGrid');
      if (!grid) return;
      var html = '';
      for (var idx = 0; idx < PKGS.length; idx++) {
        var pkg = PKGS[idx];
        var price = optB(pkg.accom, tier.disc);
        var emoji = PKG_EMOJI[pkg.name] || '🛏️';
        html += '<div class="pkg-card' + (pkg.featured ? ' featured' : '') + '" id="pkgCard' + idx + '">';
        html += '<div class="pkg-card-head" onclick="togglePkgCard(' + idx + ')">';
        html += '<div class="pkg-card-icon">' + emoji + '</div>';
        html += '<div class="pkg-card-name">' + pkg.name + '</div>';
        html += '<div class="pkg-card-tier-pill" style="background:' + tier.bg + ';color:' + tier.color + '">&#11044; ' + tier.label + '</div>';
        html += '<div class="pkg-card-price-tag" style="color:' + tier.color + '">$' + price.toLocaleString() + '</div>';
        html += '<div class="pkg-card-cta-text">' + tier.urgency + '</div>';
        html += '<button class="pkg-card-toggle">View Details &#9660;</button>';
        html += '</div>';
        html += '<div class="pkg-detail">';
        html += '<div class="pkg-detail-intro">5 nights accommodation (Jun 17&#8211;21) + 5 days services (Jun 18&#8211;22) &middot; Bed &amp; Breakfast &middot; Lunch, commute, delegate badge &amp; raffle entry all bundled.</div>';
        html += '<table class="pkg-tier-table"><thead><tr><th>Tier</th><th>Dates</th><th>Hotel Discount</th><th>Package Total</th><th>Status</th></tr></thead><tbody>';
        for (var ti2 = 0; ti2 < PKG_TIERS.length; ti2++) {
          var t = PKG_TIERS[ti2];
          var p2 = optB(pkg.accom, t.disc);
          var isCurrent = ti2 === ti;
          var isExpired = ti2 < ti;
          var rowCls = isCurrent ? 'pkg-tier-row-current' : (isExpired ? 'pkg-tier-row-expired' : '');
          var priceCell = isExpired ? '<s>$' + p2.toLocaleString() + '</s>' : '<strong style="color:' + t.color + '">$' + p2.toLocaleString() + '</strong>';
          var statusBadge = isCurrent
            ? '<span style="background:#e91e63;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800">ACTIVE</span>'
            : (isExpired ? '<span style="color:#94a3b8;font-size:11px">Expired</span>' : '<span style="color:#94a3b8;font-size:11px">Upcoming</span>');
          html += '<tr class="' + rowCls + '"><td>' + t.label + '</td><td style="white-space:nowrap">' + t.dates + '</td>';
          html += '<td>' + (t.disc > 0 ? Math.round(t.disc * 100) + '% off accom' : 'None') + '</td>';
          html += '<td>' + priceCell + '</td><td>' + statusBadge + '</td></tr>';
        }
        html += '</tbody></table>';
        var discSaving = pkg.accom - Math.round(pkg.accom * (1 - tier.disc));
        html += '<div class="pkg-breakdown">';
        html += '<div class="pkg-breakdown-row"><span>Bed &amp; Breakfast (5 nights)</span><span>$' + pkg.accom.toLocaleString() + '</span></div>';
        if (tier.disc > 0) {
          html += '<div class="pkg-breakdown-row" style="color:#16a34a"><span>Early-bird saving (' + Math.round(tier.disc * 100) + '% off accommodation)</span><span>&#8722;$' + discSaving + '</span></div>';
        }
        html += '<div class="pkg-breakdown-row"><span>Lunch &amp; Daily Commute (5 days)</span><span>$225</span></div>';
        html += '<div class="pkg-breakdown-row"><span>Delegate Badge &amp; Raffle Entry</span><span>$15</span></div>';
        html += '<div class="pkg-breakdown-row total"><span>Package Total</span><span>$' + price.toLocaleString() + '</span></div>';
        html += '</div>';
        var safeName = pkg.name.replace(/\'/g, "\\'");
        var safeTier = tier.label.replace(/\'/g, "\\'");
        html += '<button class="pkg-book-btn" style="background:linear-gradient(135deg,' + tier.color + ',#e91e63);color:white" onclick="bookPkg(\'' + safeName + '\',' + price + ',\'' + safeTier + '\')">Book This Package &#8212; ' + tier.label + ' $' + price.toLocaleString() + '</button>';
        html += '</div></div>';
      }
      grid.innerHTML = html;
      var badge = document.getElementById('pkgTierBadge');
      if (badge) {
        badge.style.background = tier.bg;
        badge.style.color = tier.color;
        badge.innerHTML = '&#11044; LIVE TIER: ' + tier.label + ' &nbsp;&middot;&nbsp; ' + (tier.disc > 0 ? Math.round(tier.disc * 100) + '% off accommodation' : 'No discount — walk-in rate');
      }
    }
    function togglePkgCard(idx) {
      var card = document.getElementById('pkgCard' + idx);
      if (!card) return;
      var wasOpen = card.classList.contains('open');
      document.querySelectorAll('.pkg-card.open').forEach(function(c) { c.classList.remove('open'); });
      if (!wasOpen) {
        card.classList.add('open');
        setTimeout(function() { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
      }
    }
    function bookPkg(name, price, tierLabel) {
      var banner = document.getElementById('pkgSelectedBanner');
      var bannerText = document.getElementById('pkgBannerText');
      if (banner && bannerText) {
        bannerText.textContent = 'Selected: ' + name + ' — ' + tierLabel + ' $' + price.toLocaleString() + '. Fill in your details below and click Register Now.';
        banner.style.display = 'flex';
      }
      var formEl = document.getElementById('register');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function updatePkgCountdown() {
      var ti = pkgCurrentTier();
      var tier = PKG_TIERS[ti];
      var el = document.getElementById('pkgCountdown');
      if (!el) return;
      if (!tier.end) { el.textContent = 'Walk-in rate is now active'; return; }
      var diff = tier.end - new Date();
      if (diff <= 0) { renderPkgCards(); return; }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      el.textContent = 'Tier closes in: ' + (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm ' + s + 's';
    }
    renderPkgCards();
    updatePkgCountdown();
    setInterval(updatePkgCountdown, 1000);

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
  <link rel="icon" type="image/svg+xml" href="/sysimages/favicon.svg">
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
  <link rel="icon" type="image/svg+xml" href="/sysimages/favicon.svg">
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

  <div style="margin:28px 48px 0;padding:24px 28px;background:rgba(255,255,255,0.88);border:1px solid rgba(244,143,177,0.18);border-radius:16px">
    <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px">Our Sponsors &amp; Partners</p>
    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center">
      <a href="https://malikale.com" target="_blank" rel="noopener" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;text-decoration:none;transition:all 0.3s" class="prev-sponsor">
        <div style="width:110px;height:62px;background:#fff;border:1px solid rgba(244,143,177,0.3);border-radius:10px;overflow:hidden;transition:all 0.3s;display:flex;align-items:center;justify-content:center">
          <img src="/sysimages/sponsors/httpsmalikale_com.png" alt="Malikale" style="width:100%;height:100%;object-fit:contain">
        </div>
        <span style="font-size:11px;color:#94a3b8;transition:color 0.2s">Malikale</span>
        <span class="prev-sp-tip" style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) scale(0.9);background:#1e293b;color:white;font-size:11px;font-weight:600;padding:5px 12px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:all 0.2s">Follow Malikale · malikale.com</span>
      </a>
      <a href="https://www.newsafarihotel.com" target="_blank" rel="noopener" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;text-decoration:none;transition:all 0.3s" class="prev-sponsor">
        <div style="width:110px;height:62px;background:#fff;border:1px solid rgba(244,143,177,0.3);border-radius:10px;overflow:hidden;transition:all 0.3s;display:flex;align-items:center;justify-content:center">
          <img src="/sysimages/sponsors/httpsnewsafarihotel_com-tanzania_com_en.png" alt="New Safari Hotel" style="width:100%;height:100%;object-fit:contain">
        </div>
        <span style="font-size:11px;color:#94a3b8;transition:color 0.2s">New Safari Hotel</span>
        <span class="prev-sp-tip" style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) scale(0.9);background:#1e293b;color:white;font-size:11px;font-weight:600;padding:5px 12px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:all 0.2s">Follow New Safari Hotel · newsafarihotel.com</span>
      </a>
      <a href="https://sabrahmsafaris.com" target="_blank" rel="noopener" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;text-decoration:none;transition:all 0.3s" class="prev-sponsor">
        <div style="width:110px;height:62px;background:#fff;border:1px solid rgba(244,143,177,0.3);border-radius:10px;overflow:hidden;transition:all 0.3s;display:flex;align-items:center;justify-content:center">
          <img src="/sysimages/sponsors/httpssabrahmsafaris_com.png" alt="Sabrahm Safaris" style="width:100%;height:100%;object-fit:contain">
        </div>
        <span style="font-size:11px;color:#94a3b8;transition:color 0.2s">Sabrahm Safaris</span>
        <span class="prev-sp-tip" style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) scale(0.9);background:#1e293b;color:white;font-size:11px;font-weight:600;padding:5px 12px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:all 0.2s">Follow Sabrahm Safaris · sabrahmsafaris.com</span>
      </a>
      <a href="https://www.rwandair.com" target="_blank" rel="noopener" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;text-decoration:none;transition:all 0.3s" class="prev-sponsor">
        <div style="width:110px;height:62px;background:#fff;border:1px solid rgba(244,143,177,0.3);border-radius:10px;overflow:hidden;transition:all 0.3s;display:flex;align-items:center;justify-content:center">
          <img src="/sysimages/sponsors/rwand_air.png" alt="RwandAir" style="width:100%;height:100%;object-fit:contain">
        </div>
        <span style="font-size:11px;color:#94a3b8;transition:color 0.2s">RwandAir</span>
        <span class="prev-sp-tip" style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) scale(0.9);background:#1e293b;color:white;font-size:11px;font-weight:600;padding:5px 12px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:all 0.2s">Follow RwandAir · rwandair.com</span>
      </a>
    </div>
  </div>
  <style>
    .prev-sponsor > div { position:relative; overflow:hidden; }
    .prev-sponsor > div::after { content:'Follow →'; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(233,30,99,0.82); color:white; font-size:13px; font-weight:800; border-radius:10px; opacity:0; transition:opacity 0.35s; font-family:'Segoe UI',sans-serif; }
    .prev-sponsor > div img { transition:opacity 0.35s, transform 0.35s; }
    .prev-sponsor:hover > div { border-color:#f06292 !important; box-shadow:0 8px 28px rgba(244,143,177,0.45) !important; transform:translateY(-4px) scale(1.04); }
    .prev-sponsor:hover > div img { opacity:0.25; transform:scale(1.08); }
    .prev-sponsor:hover > div::after { opacity:1; }
    .prev-sponsor:hover > span:first-of-type { color:#e91e63 !important; font-weight:700 !important; }
    .prev-sponsor:hover .prev-sp-tip { opacity:1 !important; transform:translateX(-50%) translateY(0) !important; }
    .prev-sp-tip { transform:translateX(-50%) translateY(4px) !important; transition:all 0.25s !important; }
    .prev-sp-tip::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:#1e293b; }
  </style>

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
//  RAFFLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/raffle/status — public
app.get('/api/raffle/status', async (req, res) => {
  if (!pool) return res.json({ voting_open: false, reveal_ready: false });
  try {
    const r = await pool.query('SELECT * FROM raffle_settings WHERE id=1');
    const s = r.rows[0] || { voting_open: false, reveal_ready: false };
    res.json({ voting_open: s.voting_open, reveal_ready: s.reveal_ready });
  } catch(e) { res.json({ voting_open: false, reveal_ready: false }); }
});

// GET /api/raffle/voter/:ticket_id — public voter lookup
app.get('/api/raffle/voter/:ticket_id', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  try {
    const r = await pool.query('SELECT ticket_id, name, ticket_type, organization FROM attendees WHERE ticket_id=$1', [req.params.ticket_id]);
    if (!r.rows[0]) return res.json({ success: false, error: 'Ticket not found' });
    const vote = await pool.query('SELECT nominee_ticket_id FROM raffle_votes WHERE voter_ticket_id=$1', [req.params.ticket_id]);
    res.json({ success: true, voter: r.rows[0], already_voted: vote.rows.length > 0, voted_for: vote.rows[0]?.nominee_ticket_id || null });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// GET /api/raffle/nominees — public nominees list (only when voting open)
app.get('/api/raffle/nominees', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  try {
    const settings = await pool.query('SELECT * FROM raffle_settings WHERE id=1');
    if (!settings.rows[0]?.voting_open) return res.json({ success: false, not_open: true, error: 'Voting is not open yet' });
    const r = await pool.query('SELECT ticket_id, name, ticket_type, organization FROM attendees ORDER BY name');
    res.json({ success: true, nominees: r.rows });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// POST /api/raffle/vote
app.post('/api/raffle/vote', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  try {
    const { voter_ticket_id, nominee_ticket_id } = req.body;
    if (!voter_ticket_id || !nominee_ticket_id) return res.json({ success: false, error: 'Missing fields' });
    if (voter_ticket_id.trim() === nominee_ticket_id.trim()) return res.json({ success: false, error: 'You cannot vote for yourself' });
    const settings = await pool.query('SELECT * FROM raffle_settings WHERE id=1');
    if (!settings.rows[0]?.voting_open) return res.json({ success: false, error: 'Voting is not open' });
    const voter = await pool.query('SELECT ticket_id, name FROM attendees WHERE ticket_id=$1', [voter_ticket_id]);
    if (!voter.rows[0]) return res.json({ success: false, error: 'Your ticket was not found' });
    const nominee = await pool.query('SELECT ticket_id, name FROM attendees WHERE ticket_id=$1', [nominee_ticket_id]);
    if (!nominee.rows[0]) return res.json({ success: false, error: 'Nominee ticket not found' });
    await pool.query('INSERT INTO raffle_votes (voter_ticket_id, nominee_ticket_id) VALUES ($1, $2)', [voter_ticket_id.trim(), nominee_ticket_id.trim()]);
    res.json({ success: true, message: 'Vote recorded!', nominee_name: nominee.rows[0].name });
  } catch(e) {
    if (e.code === '23505') return res.json({ success: false, error: 'You have already cast your vote' });
    res.json({ success: false, error: e.message });
  }
});

// GET /api/raffle/winners — public, only when reveal_ready
app.get('/api/raffle/winners', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  try {
    const settings = await pool.query('SELECT * FROM raffle_settings WHERE id=1');
    if (!settings.rows[0]?.reveal_ready) return res.json({ success: false, not_ready: true });
    const r = await pool.query(`
      SELECT rv.nominee_ticket_id, a.name, a.ticket_type, a.organization, COUNT(*)::int AS votes
      FROM raffle_votes rv
      JOIN attendees a ON a.ticket_id = rv.nominee_ticket_id
      GROUP BY rv.nominee_ticket_id, a.name, a.ticket_type, a.organization
      ORDER BY votes DESC LIMIT 3
    `);
    const total = await pool.query('SELECT COUNT(*)::int AS c FROM raffle_votes');
    res.json({ success: true, winners: r.rows, total_votes: total.rows[0].c });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// GET /api/raffle/leaderboard — admin only
app.get('/api/raffle/leaderboard', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  const cookies = parseCookies(req);
  if (!verifyAdminToken(cookies.admin_token)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const r = await pool.query(`
      SELECT rv.nominee_ticket_id, a.name, a.ticket_type, a.organization, COUNT(*)::int AS votes
      FROM raffle_votes rv
      JOIN attendees a ON a.ticket_id = rv.nominee_ticket_id
      GROUP BY rv.nominee_ticket_id, a.name, a.ticket_type, a.organization
      ORDER BY votes DESC LIMIT 20
    `);
    const total = await pool.query('SELECT COUNT(*)::int AS c FROM raffle_votes');
    const settings = await pool.query('SELECT * FROM raffle_settings WHERE id=1');
    const s = settings.rows[0] || { voting_open: false, reveal_ready: false };
    res.json({ success: true, leaderboard: r.rows, total_votes: total.rows[0].c, voting_open: s.voting_open, reveal_ready: s.reveal_ready });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// POST /api/raffle/toggle — admin toggle voting
app.post('/api/raffle/toggle', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  const cookies = parseCookies(req);
  if (!verifyAdminToken(cookies.admin_token)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const r = await pool.query('SELECT voting_open FROM raffle_settings WHERE id=1');
    const next = !r.rows[0]?.voting_open;
    await pool.query('UPDATE raffle_settings SET voting_open=$1 WHERE id=1', [next]);
    res.json({ success: true, voting_open: next });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// POST /api/raffle/reveal-toggle — admin toggle reveal
app.post('/api/raffle/reveal-toggle', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  const cookies = parseCookies(req);
  if (!verifyAdminToken(cookies.admin_token)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const r = await pool.query('SELECT reveal_ready FROM raffle_settings WHERE id=1');
    const next = !r.rows[0]?.reveal_ready;
    await pool.query('UPDATE raffle_settings SET reveal_ready=$1 WHERE id=1', [next]);
    res.json({ success: true, reveal_ready: next });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// POST /api/raffle/reset — admin reset
app.post('/api/raffle/reset', async (req, res) => {
  if (!pool) return res.json({ success: false, error: 'Database not ready' });
  const cookies = parseCookies(req);
  if (!verifyAdminToken(cookies.admin_token)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    await pool.query('DELETE FROM raffle_votes');
    await pool.query('UPDATE raffle_settings SET voting_open=false, reveal_ready=false WHERE id=1');
    res.json({ success: true, message: 'Raffle reset' });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// ── PUBLIC RAFFLE PAGES ──────────────────────────────────────────────────────

// GET /raffle — entry page
app.get('/raffle', async (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎰 Raffle — Africa Convention 2026</title>
  <link rel="icon" type="image/svg+xml" href="/sysimages/favicon.svg">
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:linear-gradient(160deg,#e8f4fd 0%,#fdf0f7 40%,#eef4ff 100%);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
    .card{background:white;border-radius:24px;padding:36px 32px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(244,143,177,0.25);text-align:center}
    .icon{font-size:52px;margin-bottom:12px}
    h1{font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px}
    .sub{color:#64748b;font-size:14px;margin-bottom:28px;line-height:1.5}
    #scanner-box{width:100%;margin-bottom:18px;border-radius:14px;overflow:hidden;background:#f8fafc}
    .btn{display:block;width:100%;padding:13px;background:linear-gradient(135deg,#f48fb1,#ce93d8);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;transition:all 0.2s;font-family:inherit}
    .btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(244,143,177,0.45)}
    .btn-outline{background:white;color:#e91e63;border:2px solid rgba(244,143,177,0.5)}
    .btn-outline:hover{background:rgba(244,143,177,0.06);box-shadow:none}
    .divider{display:flex;align-items:center;gap:10px;margin:18px 0;color:#94a3b8;font-size:13px}
    .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(244,143,177,0.25)}
    input{width:100%;padding:12px 14px;border:2px solid rgba(244,143,177,0.3);border-radius:10px;font-size:15px;color:#374151;margin-bottom:12px;font-family:inherit;background:#fff}
    input:focus{outline:none;border-color:#f06292;box-shadow:0 0 0 3px rgba(244,143,177,0.18)}
    .msg{padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;margin-top:12px;display:none}
    .msg.error{background:rgba(254,202,202,0.25);color:#e11d48;border-left:4px solid #f87171;display:block}
    .msg.info{background:rgba(167,243,208,0.22);color:#059669;border-left:4px solid #34d399;display:block}
    .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:20px}
    .status-open{background:rgba(167,243,208,0.3);color:#059669;border:1px solid rgba(167,243,208,0.6)}
    .status-closed{background:rgba(254,202,202,0.3);color:#e11d48;border:1px solid rgba(252,165,165,0.5)}
    footer{text-align:center;padding:20px;font-style:italic;font-size:7px;color:#94a3b8;margin-top:18px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎰</div>
    <h1>Africa Convention Raffle</h1>
    <p class="sub">Nominate a fellow delegate for an organiser gift.<br>Scan your badge QR — or type your Ticket ID.</p>
    <div id="statusBadge" class="status-badge status-closed">Checking status…</div>

    <div id="scanner-box"><div id="qr-entry" style="width:100%"></div></div>
    <button class="btn" id="startBtn" onclick="startScan()">📷 Scan My Badge QR</button>
    <button class="btn btn-outline" id="stopBtn" onclick="stopScan()" style="display:none">⏹ Stop Camera</button>

    <div class="divider">or enter manually</div>
    <input id="ticketInput" placeholder="Your Ticket ID (e.g. TKT-00001)" onkeydown="if(event.key==='Enter')enterTicket()">
    <button class="btn" onclick="enterTicket()">▶ Continue to Vote</button>

    <div id="msg" class="msg"></div>
  </div>
  <footer>© Faith&amp;Will Logi-Tec Solutions · Designed by LEAD ICT ENG. RAPHAEL CHARLES MSESI · raphayelchas@gmail.com · +255 743 868 755 · All Rights Reserved</footer>

  <script>
    var scanner = null;

    fetch('/api/raffle/status').then(r=>r.json()).then(function(s){
      var el = document.getElementById('statusBadge');
      if(s.reveal_ready){ el.textContent='🏆 Results Available'; el.className='status-badge status-open'; window.location.href='/raffle/reveal'; return; }
      if(s.voting_open){ el.textContent='✅ Voting is Open'; el.className='status-badge status-open'; }
      else { el.textContent='🔒 Voting not yet open'; el.className='status-badge status-closed'; }
    });

    function startScan(){
      document.getElementById('startBtn').style.display='none';
      document.getElementById('stopBtn').style.display='block';
      scanner = new Html5Qrcode('qr-entry');
      scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},function(code){
        stopScan();
        var tid;
        try{ var obj=JSON.parse(code); tid=obj.ticket_id||code; }catch(_){ tid=code; }
        window.location.href='/raffle/vote/'+encodeURIComponent(tid.trim());
      },function(){});
    }

    function stopScan(){
      if(scanner){ try{ scanner.stop().then(function(){ scanner.clear(); scanner=null; }); }catch(_){} }
      document.getElementById('startBtn').style.display='block';
      document.getElementById('stopBtn').style.display='none';
    }

    function enterTicket(){
      var tid = document.getElementById('ticketInput').value.trim();
      if(!tid){ showMsg('Please enter your Ticket ID','error'); return; }
      window.location.href='/raffle/vote/'+encodeURIComponent(tid);
    }

    function showMsg(txt, type){
      var el = document.getElementById('msg');
      el.textContent = txt;
      el.className = 'msg ' + type;
    }
  </script>
</body>
</html>`);
});

// GET /raffle/vote/:ticket_id — nomination page
app.get('/raffle/vote/:ticket_id', async (req, res) => {
  const ticket_id = req.params.ticket_id;
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cast Your Vote — Africa Convention 2026</title>
  <link rel="icon" type="image/svg+xml" href="/sysimages/favicon.svg">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:linear-gradient(160deg,#e8f4fd 0%,#fdf0f7 40%,#eef4ff 100%);min-height:100vh;padding:24px}
    .header{max-width:600px;margin:0 auto 22px;text-align:center}
    .header h1{font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px}
    .voter-card{background:white;border-radius:16px;padding:16px 20px;max-width:600px;margin:0 auto 20px;box-shadow:0 4px 20px rgba(244,143,177,0.18);display:flex;align-items:center;gap:14px}
    .voter-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f48fb1,#ce93d8);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
    .voter-info h3{font-size:15px;font-weight:700;color:#1e293b}
    .voter-info p{font-size:12px;color:#64748b}
    .voted-banner{background:rgba(167,243,208,0.25);border:1px solid rgba(167,243,208,0.6);border-radius:12px;padding:16px 20px;max-width:600px;margin:0 auto 20px;text-align:center;color:#059669;font-weight:700;font-size:15px;display:none}
    .search-wrap{max-width:600px;margin:0 auto 14px}
    input[type=text]{width:100%;padding:12px 14px;border:2px solid rgba(244,143,177,0.3);border-radius:10px;font-size:14px;color:#374151;font-family:inherit;background:#fff}
    input[type=text]:focus{outline:none;border-color:#f06292;box-shadow:0 0 0 3px rgba(244,143,177,0.18)}
    .nominees{max-width:600px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media(max-width:480px){.nominees{grid-template-columns:1fr}}
    .nominee{background:white;border-radius:12px;padding:14px 16px;cursor:pointer;transition:all 0.2s;border:2px solid transparent;box-shadow:0 2px 10px rgba(244,143,177,0.1)}
    .nominee:hover{border-color:#f48fb1;transform:translateY(-2px);box-shadow:0 6px 20px rgba(244,143,177,0.22)}
    .nominee.selected{border-color:#e91e63;background:rgba(244,143,177,0.08)}
    .nominee-name{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px}
    .nominee-meta{font-size:11px;color:#64748b}
    .nominee-type{display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-top:4px;background:rgba(244,143,177,0.15);color:#e91e63}
    .submit-wrap{max-width:600px;margin:20px auto 0;text-align:center}
    .btn-submit{padding:14px 36px;background:linear-gradient(135deg,#f48fb1,#ce93d8);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.2s;font-family:inherit;display:none}
    .btn-submit:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(244,143,177,0.45)}
    .btn-back{display:inline-block;margin-top:14px;color:#94a3b8;font-size:13px;cursor:pointer;background:none;border:none;font-family:inherit}
    .btn-back:hover{color:#e91e63;transform:none;box-shadow:none}
    .empty{text-align:center;color:#94a3b8;padding:40px;font-size:14px;grid-column:1/-1}
    .msg{padding:14px 18px;border-radius:10px;font-size:15px;font-weight:700;margin:0 auto 16px;max-width:600px;display:none}
    .msg.error{background:rgba(254,202,202,0.25);color:#e11d48;border-left:4px solid #f87171;display:block}
    .msg.success{background:rgba(167,243,208,0.22);color:#059669;border-left:4px solid #34d399;display:block}
    .loading{text-align:center;padding:60px;color:#94a3b8;font-size:15px;max-width:600px;margin:0 auto}
    footer{text-align:center;padding:24px 16px;font-style:italic;font-size:7px;color:#94a3b8;margin-top:20px}
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:38px;margin-bottom:8px">🎰</div>
    <h1>Cast Your Vote</h1>
    <p style="color:#64748b;font-size:13px;margin-top:4px">Nominate a delegate — top 3 nominees win an organiser gift</p>
  </div>

  <div id="voterCard" class="voter-card" style="display:none">
    <div class="voter-avatar">🎫</div>
    <div class="voter-info">
      <h3 id="voterName">—</h3>
      <p id="voterMeta">—</p>
    </div>
  </div>

  <div id="votedBanner" class="voted-banner"></div>
  <div id="globalMsg" class="msg"></div>

  <div id="loading" class="loading">Loading nominees…</div>

  <div class="search-wrap" id="searchWrap" style="display:none">
    <input type="text" id="searchInput" placeholder="🔍  Search by name or organisation…" oninput="filterNominees()">
  </div>

  <div class="nominees" id="nomineesList"></div>

  <div class="submit-wrap" id="submitWrap" style="display:none">
    <div style="margin-bottom:12px;color:#64748b;font-size:13px">Nominating: <strong id="selectedName" style="color:#e91e63"></strong></div>
    <button class="btn-submit" id="submitBtn" onclick="submitVote()">🗳️ Confirm Vote</button>
    <div><button class="btn-back" onclick="clearSelection()">↩ Change selection</button></div>
  </div>

  <div style="text-align:center;margin-top:10px">
    <button class="btn-back" onclick="window.location.href='/raffle'">← Back to Entry</button>
  </div>

  <footer>© Faith&amp;Will Logi-Tec Solutions · Designed by LEAD ICT ENG. RAPHAEL CHARLES MSESI · raphayelchas@gmail.com · +255 743 868 755 · All Rights Reserved</footer>

  <script>
    var VOTER_ID = ${JSON.stringify(ticket_id)};
    var allNominees = [];
    var selectedId = null;
    var selectedName = '';
    var alreadyVoted = false;

    function esc(s){ var d=document.createElement('div'); d.appendChild(document.createTextNode(s||'')); return d.innerHTML; }

    async function init(){
      // Load voter info
      var vr = await fetch('/api/raffle/voter/'+encodeURIComponent(VOTER_ID)).then(r=>r.json());
      if(!vr.success){ showMsg(vr.error||'Ticket not found','error'); document.getElementById('loading').style.display='none'; return; }
      document.getElementById('voterCard').style.display='flex';
      document.getElementById('voterName').textContent = vr.voter.name;
      document.getElementById('voterMeta').textContent = (vr.voter.organization||'') + (vr.voter.organization && vr.voter.ticket_type ? ' · ' : '') + (vr.voter.ticket_type||'');

      if(vr.already_voted){
        alreadyVoted = true;
        var vb = document.getElementById('votedBanner');
        vb.style.display='block';
        vb.innerHTML = '✅ Your vote has been recorded. Thank you for participating! <br><small style="font-weight:400;opacity:0.8">You voted earlier in this session.</small>';
        document.getElementById('loading').style.display='none';
        return;
      }

      // Load nominees
      var nr = await fetch('/api/raffle/nominees').then(r=>r.json());
      document.getElementById('loading').style.display='none';
      if(!nr.success){
        if(nr.not_open) showMsg('Voting is not open yet. Please wait for the organiser to open the raffle.','error');
        else showMsg(nr.error||'Error loading nominees','error');
        return;
      }
      allNominees = nr.nominees.filter(function(n){ return n.ticket_id !== VOTER_ID; });
      document.getElementById('searchWrap').style.display='block';
      renderNominees(allNominees);
    }

    function renderNominees(list){
      var el = document.getElementById('nomineesList');
      if(!list.length){ el.innerHTML='<div class="empty">No delegates found</div>'; return; }
      el.innerHTML = list.map(function(n){
        return '<div class="nominee" id="nc-'+esc(n.ticket_id)+'" onclick="selectNominee('+JSON.stringify(n.ticket_id)+','+JSON.stringify(n.name)+')">'
          + '<div class="nominee-name">'+esc(n.name)+'</div>'
          + (n.organization ? '<div class="nominee-meta">'+esc(n.organization)+'</div>' : '')
          + '<span class="nominee-type">'+esc(n.ticket_type||'delegate')+'</span>'
          + '</div>';
      }).join('');
    }

    function filterNominees(){
      var q = document.getElementById('searchInput').value.toLowerCase();
      var filtered = allNominees.filter(function(n){
        return (n.name||'').toLowerCase().includes(q)||(n.organization||'').toLowerCase().includes(q);
      });
      renderNominees(filtered);
    }

    function selectNominee(id, name){
      if(alreadyVoted) return;
      document.querySelectorAll('.nominee').forEach(function(el){ el.classList.remove('selected'); });
      var card = document.getElementById('nc-'+id);
      if(card) card.classList.add('selected');
      selectedId = id;
      selectedName = name;
      document.getElementById('selectedName').textContent = name;
      var sw = document.getElementById('submitWrap');
      sw.style.display='block';
      document.getElementById('submitBtn').style.display='inline-block';
      sw.scrollIntoView({behavior:'smooth',block:'nearest'});
    }

    function clearSelection(){
      selectedId = null; selectedName = '';
      document.querySelectorAll('.nominee').forEach(function(el){ el.classList.remove('selected'); });
      document.getElementById('submitWrap').style.display='none';
    }

    async function submitVote(){
      if(!selectedId){ showMsg('Please select a nominee first','error'); return; }
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Submitting…';
      var r = await fetch('/api/raffle/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voter_ticket_id:VOTER_ID,nominee_ticket_id:selectedId})}).then(r=>r.json());
      if(r.success){
        document.getElementById('nomineesList').style.display='none';
        document.getElementById('searchWrap').style.display='none';
        document.getElementById('submitWrap').style.display='none';
        var vb = document.getElementById('votedBanner');
        vb.style.display='block';
        vb.innerHTML = '🎉 Vote cast! You nominated <strong>'+esc(r.nominee_name)+'</strong>.<br><small style="font-weight:400;opacity:0.8">Thank you for participating in the Africa Convention Raffle!</small>';
      } else {
        showMsg(r.error||'Error submitting vote','error');
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('submitBtn').textContent = '🗳️ Confirm Vote';
      }
    }

    function showMsg(txt, type){
      var el = document.getElementById('globalMsg');
      el.textContent = txt;
      el.className = 'msg '+type;
    }

    init();
  </script>
</body>
</html>`);
});

// GET /raffle/reveal — animated winner reveal
app.get('/raffle/reveal', async (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏆 Raffle Winners — Africa Convention 2026</title>
  <link rel="icon" type="image/svg+xml" href="/sysimages/favicon.svg">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:linear-gradient(160deg,#1e0a2e 0%,#2d1040 50%,#1a0a28 100%);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;overflow:hidden}
    .stage{text-align:center;max-width:700px;width:100%}
    .title{font-size:14px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:rgba(244,143,177,0.7);margin-bottom:8px}
    h1{font-size:34px;font-weight:900;background:linear-gradient(135deg,#ffd700,#f48fb1,#ce93d8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
    .subtitle{color:rgba(200,160,255,0.65);font-size:14px;margin-bottom:40px}
    .waiting{text-align:center;padding:60px 0}
    .waiting .icon{font-size:64px;margin-bottom:16px;animation:pulse 2s ease-in-out infinite}
    .waiting h2{color:rgba(240,220,255,0.85);font-size:22px;margin-bottom:10px}
    .waiting p{color:rgba(200,160,255,0.55);font-size:14px}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
    .winners{display:flex;flex-direction:column;gap:18px;margin-top:10px}
    .winner-card{border-radius:20px;padding:22px 28px;display:flex;align-items:center;gap:20px;opacity:0;transform:translateY(30px);transition:all 0.7s ease-out;position:relative;overflow:hidden}
    .winner-card.show{opacity:1;transform:translateY(0)}
    .winner-card.rank-1{background:linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,180,0,0.08));border:2px solid rgba(255,215,0,0.5);box-shadow:0 8px 40px rgba(255,215,0,0.2)}
    .winner-card.rank-2{background:linear-gradient(135deg,rgba(192,192,192,0.18),rgba(160,160,160,0.08));border:2px solid rgba(192,192,192,0.5);box-shadow:0 8px 30px rgba(192,192,192,0.15)}
    .winner-card.rank-3{background:linear-gradient(135deg,rgba(205,127,50,0.18),rgba(180,100,30,0.08));border:2px solid rgba(205,127,50,0.45);box-shadow:0 8px 24px rgba(205,127,50,0.15)}
    .rank-badge{font-size:38px;flex-shrink:0;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.4))}
    .winner-info{flex:1;text-align:left}
    .winner-name{font-size:20px;font-weight:800;color:white;margin-bottom:4px}
    .winner-meta{font-size:13px;color:rgba(200,160,255,0.7)}
    .winner-votes{text-align:right;flex-shrink:0}
    .votes-count{font-size:28px;font-weight:900;background:linear-gradient(135deg,#ffd700,#f48fb1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .votes-label{font-size:11px;color:rgba(200,160,255,0.5);text-transform:uppercase;letter-spacing:1px}
    .gift-label{display:inline-block;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:700;margin-top:6px;background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3)}
    .total-votes{text-align:center;margin-top:28px;color:rgba(200,160,255,0.5);font-size:13px}
    .confetti{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1}
    .particle{position:absolute;width:8px;height:8px;border-radius:50%;animation:fall linear infinite}
    @keyframes fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
    footer{text-align:center;padding:24px 16px;font-style:italic;font-size:7px;color:rgba(150,100,180,0.5);margin-top:20px}
  </style>
</head>
<body>
  <div class="confetti" id="confetti"></div>
  <div class="stage">
    <div class="title">Africa Convention 2026</div>
    <h1>🏆 Raffle Results</h1>
    <p class="subtitle">And the top nominees are…</p>

    <div id="waiting" class="waiting">
      <div class="icon">⏳</div>
      <h2>Results Pending</h2>
      <p>The organiser will reveal the winners shortly.<br>This page will update automatically.</p>
    </div>

    <div id="winnersSection" style="display:none">
      <div class="winners" id="winnersList"></div>
      <div class="total-votes" id="totalVotes"></div>
    </div>
  </div>
  <footer>© Faith&amp;Will Logi-Tec Solutions · Designed by LEAD ICT ENG. RAPHAEL CHARLES MSESI · raphayelchas@gmail.com · +255 743 868 755 · All Rights Reserved</footer>

  <script>
    var medals = ['🥇','🥈','🥉'];
    var giftLabels = ['🎁 1st Prize — Organiser Gift','🎁 2nd Prize — Organiser Gift','🎁 3rd Prize — Organiser Gift'];
    var rankClasses = ['rank-1','rank-2','rank-3'];
    var pollInterval = null;

    function spawnConfetti(){
      var colors=['#ffd700','#f48fb1','#ce93d8','#4fc3f7','#a5f3fc','#fce4ec'];
      var c = document.getElementById('confetti');
      for(var i=0;i<60;i++){
        var p=document.createElement('div');
        p.className='particle';
        p.style.left=Math.random()*100+'%';
        p.style.background=colors[Math.floor(Math.random()*colors.length)];
        p.style.animationDuration=(3+Math.random()*4)+'s';
        p.style.animationDelay=(Math.random()*3)+'s';
        p.style.width=p.style.height=(6+Math.random()*8)+'px';
        c.appendChild(p);
      }
    }

    function esc(s){ var d=document.createElement('div'); d.appendChild(document.createTextNode(s||'')); return d.innerHTML; }

    function showWinners(winners, total){
      document.getElementById('waiting').style.display='none';
      document.getElementById('winnersSection').style.display='block';
      var list = document.getElementById('winnersList');
      list.innerHTML = winners.map(function(w,i){
        return '<div class="winner-card '+rankClasses[i]+'" id="wcard-'+i+'">'
          + '<div class="rank-badge">'+medals[i]+'</div>'
          + '<div class="winner-info">'
          + '<div class="winner-name">'+esc(w.name)+'</div>'
          + '<div class="winner-meta">'+(w.organization||w.ticket_type||'')+'</div>'
          + '<span class="gift-label">'+giftLabels[i]+'</span>'
          + '</div>'
          + '<div class="winner-votes"><div class="votes-count">'+w.votes+'</div><div class="votes-label">votes</div></div>'
          + '</div>';
      }).join('');
      document.getElementById('totalVotes').textContent = 'Total votes cast: ' + total;
      spawnConfetti();
      // Staggered reveal
      winners.forEach(function(_,i){
        setTimeout(function(){
          var card = document.getElementById('wcard-'+i);
          if(card) card.classList.add('show');
        }, 400 + i * 700);
      });
    }

    function poll(){
      fetch('/api/raffle/winners').then(r=>r.json()).then(function(d){
        if(d.success && d.winners && d.winners.length){
          if(pollInterval){ clearInterval(pollInterval); pollInterval=null; }
          showWinners(d.winners, d.total_votes);
        }
      }).catch(function(){});
    }

    poll();
    pollInterval = setInterval(poll, 5000);
  </script>
</body>
</html>`);
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
