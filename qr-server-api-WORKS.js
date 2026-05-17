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

const htmlPage = `<!DOCTYPE html>
<html>
<head>
<title>Africa Convention</title>
<style>
body { font-family: Arial; background: #667eea; padding: 20px; margin: 0; }
.container { max-width: 800px; margin: 0 auto; }
.card { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; }
h1 { color: white; }
h2 { color: #333; }
input, select { width: 100%; padding: 8px; margin: 5px 0; }
button { background: #667eea; color: white; padding: 10px 20px; border: 0; cursor: pointer; border-radius: 3px; }
.num { font-size: 32px; color: #667eea; }
.att { background: #f5f5f5; padding: 10px; margin: 5px 0; }
.ok { color: green; padding: 10px; background: #e8f5e9; }
.err { color: red; padding: 10px; background: #ffebee; }
</style>
</head>
<body>
<div class="container">
<h1>Africa Convention Dashboard</h1>
<div class="card">
<h2>Stats</h2>
Total: <span class="num" id="total">0</span><br>
Checked: <span class="num" id="checked">0</span><br>
Rate: <span class="num" id="rate">0</span>%
</div>
<div class="card">
<h2>Add</h2>
<div id="msg"></div>
<input id="name" placeholder="Name">
<input id="email" placeholder="Email">
<input id="phone" placeholder="Phone">
<select id="cat"><option>Youth</option><option>Speaker</option><option>Business</option></select>
<button onclick="add()">Add</button>
</div>
<div class="card">
<h2>Checkin</h2>
<input id="cid" type="number" placeholder="ID">
<button onclick="cin()">Checkin</button>
</div>
<div class="card">
<h2>List</h2>
<div id="list"></div>
</div>
</div>
<script>
function loadStats() {
  fetch('/api/stats').then(r => r.json()).then(d => {
    document.getElementById('total').textContent = d.total || 0;
    document.getElementById('checked').textContent = d.checked || 0;
    document.getElementById('rate').textContent = d.rate || 0;
  });
}
function loadList() {
  fetch('/api/attendees').then(r => r.json()).then(d => {
    const att = d.attendees || [];
    let h = '';
    for (let i = 0; i < att.length; i++) {
      h += '<div class="att">ID:' + att[i].id + ' ' + att[i].name + ' ' + (att[i].checked_in ? 'IN' : 'WAIT') + '</div>';
    }
    document.getElementById('list').innerHTML = h || 'none';
  });
}
function add() {
  const n = document.getElementById('name').value;
  const e = document.getElementById('email').value;
  const p = document.getElementById('phone').value;
  const c = document.getElementById('cat').value;
  if (!n || !e) return alert('Name and email');
  fetch('/api/attendees', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: n, email: e, phone: p, category: c})
  }).then(r => r.json()).then(d => {
    if (d.id) {
      document.getElementById('msg').innerHTML = '<div class="ok">Added ID: ' + d.id + '</div>';
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      document.getElementById('phone').value = '';
      loadStats();
      loadList();
    }
  });
}
function cin() {
  const id = parseInt(document.getElementById('cid').value);
  if (!id) return alert('ID');
  fetch('/api/checkin', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id: id})
  }).then(r => r.json()).then(d => {
    if (d.success) {
      alert('OK');
      document.getElementById('cid').value = '';
      loadStats();
      loadList();
    }
  });
}
setInterval(function() { loadStats(); loadList(); }, 5000);
loadStats();
loadList();
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(htmlPage);
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
    res.json({ total: 0, checked: 0, rate: 0 });
  }
});

app.get('/api/attendees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attendees ORDER BY id DESC');
    res.json({ attendees: result.rows });
  } catch (err) {
    res.json({ attendees: [] });
  }
});

app.post('/api/attendees', async (req, res) => {
  const { name, email, phone, category } = req.body;
  try {
    const result = await pool.query('INSERT INTO attendees (name, email, phone, category) VALUES ($1, $2, $3, $4) RETURNING *', [name, email, phone, category]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkin', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query('UPDATE attendees SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

async function initDb() {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS attendees (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, phone VARCHAR(20), category VARCHAR(100), checked_in BOOLEAN DEFAULT false, checked_in_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    console.log('DB OK');
  } catch (err) {
    console.error('DB error:', err);
  }
}

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Server on ' + PORT);
  });
});
