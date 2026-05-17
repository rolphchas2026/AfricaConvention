const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
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

// Serve HTML dashboard
app.get('/', (req, res) => {
  const html = '<!DOCTYPE html><html><head><title>Africa Convention Dashboard</title><style>body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;margin:0;padding:20px}.container{max-width:1200px;margin:0 auto}header{background:white;padding:20px;border-radius:10px;margin-bottom:20px}h1{margin:0;color:333}p{margin:5px 0;color:666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-bottom:20px}.card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}.card h2{margin:0 0 10px 0;color:#667eea;font-size:14px}.card .number{font-size:32px;font-weight:bold;color:333}.section{background:white;padding:20px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}.section h2{margin:0 0 15px 0;color:333;border-bottom:2px solid #667eea;padding-bottom:10px}button{background:#667eea;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-weight:bold}button:hover{background:#764ba2}input,select{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:5px;font-size:14px}.form-group{margin-bottom:15px}label{display:block;margin-bottom:5px;color:333;font-weight:bold}.success{color:green;padding:10px;background:#e8f5e9;border-radius:5px;margin-bottom:10px}.error{color:red;padding:10px;background:#ffebee;border-radius:5px;margin-bottom:10px}.attendee{background:#f5f5f5;padding:10px;margin:5px 0;border-radius:5px;border-left:4px solid #667eea;font-size:13px}</style></head><body><div class="container"><header><h1>Africa Convention - Dashboard</h1><p>Live Event Management System</p></header><div class="grid"><div class="card"><h2>Total Registered</h2><div class="number" id="total">0</div></div><div class="card"><h2>Checked In</h2><div class="number" id="checked">0</div></div><div class="card"><h2>Check-in Rate</h2><div class="number" id="rate">0%</div></div></div><div class="section"><h2>Add New Attendee</h2><div id="message"></div><form id="addForm"><div class="form-group"><label>Name:</label><input type="text" id="name" required></div><div class="form-group"><label>Email:</label><input type="email" id="email" required></div><div class="form-group"><label>Phone:</label><input type="tel" id="phone"></div><div class="form-group"><label>Category:</label><select id="category"><option>Youth</option><option>Speaker</option><option>Business</option></select></div><button type="submit">Add Attendee</button></form></div><div class="section"><h2>Check-in by ID</h2><div class="form-group"><label>Attendee ID:</label><input type="number" id="checkinId"></div><button onclick="checkIn()">Check In</button></div><div class="section"><h2>Attendees List</h2><div id="attendees"></div></div></div><script>function loadStats(){fetch("/api/stats").then(r=>r.json()).then(data=>{document.getElementById("total").textContent=data.total||0;document.getElementById("checked").textContent=data.checked||0;document.getElementById("rate").textContent=(data.rate||0)+"%"}).catch(e=>console.error("Stats error:",e))}function loadAttendees(){fetch("/api/attendees").then(r=>r.json()).then(data=>{const html=(data.attendees||[]).map(a=>"<div class=\"attendee\"><strong>ID: "+a.id+" - "+a.name+"</strong><br>"+a.email+" | "+a.category+" | "+(a.checked_in?"Checked In":"Waiting")+"</div>").join("");document.getElementById("attendees").innerHTML=html||"<p>No attendees</p>"}).catch(e=>console.error("Attendees error:",e))}function addAttendee(e){e.preventDefault();const name=document.getElementById("name").value;const email=document.getElementById("email").value;const phone=document.getElementById("phone").value;const category=document.getElementById("category").value;fetch("/api/attendees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,phone,category})}).then(r=>r.json()).then(data=>{if(data.id){document.getElementById("message").innerHTML="<div class=\"success\">Attendee added! ID: "+data.id+"</div>";document.getElementById("addForm").reset();loadStats();loadAttendees()}else{document.getElementById("message").innerHTML="<div class=\"error\">Error: "+(data.error||"Unknown error")+"</div>"}}).catch(e=>{console.error("Error:",e);document.getElementById("message").innerHTML="<div class=\"error\">Error adding attendee</div>"})}function checkIn(){const id=document.getElementById("checkinId").value;if(!id){alert("Enter attendee ID");return}fetch("/api/checkin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:parseInt(id)})}).then(r=>r.json()).then(data=>{if(data.success){alert("Checked in!");document.getElementById("checkinId").value="";loadStats();loadAttendees()}else{alert("Error: "+(data.error||"Failed"))}}).catch(e=>alert("Error: "+e.message))}document.getElementById("addForm").addEventListener("submit",addAttendee);setInterval(()=>{loadStats();loadAttendees()},5000);loadStats();loadAttendees()</script></body></html>';
  res.send(html);
});

app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN checked_in = true THEN 1 END) as checked FROM attendees');
    const row = result.rows[0] || { total: 0, checked: 0 };
    const total = parseInt(row.total) || 0;
    const checked = parseInt(row.checked) || 0;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;
    res.json({ total: total, checked: checked, rate: rate });
  } catch (err) {
    console.error('Stats error:', err);
    res.json({ total: 0, checked: 0, rate: 0 });
  }
});

app.get('/api/attendees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attendees ORDER BY id DESC');
    res.json({ attendees: result.rows });
  } catch (err) {
    console.error('Get error:', err);
    res.json({ attendees: [] });
  }
});

app.post('/api/attendees', async (req, res) => {
  const { name, email, phone, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO attendees (name, email, phone, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone, category]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkin', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Not found' });
    }
    res.json({ success: true, message: 'Checked in' });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

async function initDb() {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS attendees (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, phone VARCHAR(20), category VARCHAR(100), checked_in BOOLEAN DEFAULT false, checked_in_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    console.log('Database OK');
  } catch (err) {
    console.error('DB init error:', err);
  }
}

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
  });
});
