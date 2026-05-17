# 🎟️ QR SCANNER CHECK-IN SYSTEM - SETUP GUIDE
## 2026 Africa Convention | Arusha, Tanzania

---

## 📋 TABLE OF CONTENTS
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Docker Deployment](#docker-deployment)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [QR Code Generation](#qr-code-generation)
7. [Offline-First Features](#offline-first-features)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────┐
│     FRONTEND (React)                            │
│  • QR Scanner (device camera)                   │
│  • Manual Entry Form                            │
│  • Real-time Statistics                         │
│  • Offline LocalStorage Persistence             │
└──────────────────┬──────────────────────────────┘
                   │ (HTTP/HTTPS)
                   ↓
┌─────────────────────────────────────────────────┐
│     NODE.JS / EXPRESS API                       │
│  • QR Data Processing                           │
│  • PostgreSQL Native Queries                    │
│  • Health Checks                                │
│  • CSV/JSON Export                              │
└──────────────────┬──────────────────────────────┘
                   │ (TCP 5432)
                   ↓
┌─────────────────────────────────────────────────┐
│     POSTGRESQL DATABASE                         │
│  • attendees table (indexed)                    │
│  • checkins_log (audit trail)                   │
│  • daily_stats (reporting)                      │
└─────────────────────────────────────────────────┘

DEPLOYMENT: Docker Compose (3 containers)
  • PostgreSQL 15-Alpine
  • Node.js 18-Alpine
  • Nginx (reverse proxy, optional)
```

---

## ✅ PREREQUISITES

### Option A: Local Development
- **Node.js** 18+ (check: `node --version`)
- **PostgreSQL** 12+ (check: `psql --version`)
- **npm** 9+
- **Git**
- A modern web browser with camera access
- **Optional:** Postman or curl for API testing

### Option B: Docker Deployment (Recommended)
- **Docker** 20.10+ (check: `docker --version`)
- **Docker Compose** 2.0+ (check: `docker-compose --version`)
- **5GB disk space** for container images & DB storage

---

## 🚀 LOCAL DEVELOPMENT SETUP

### Step 1: Clone/Setup Project

```bash
# Create project directory
mkdir qr-checkin && cd qr-checkin

# Initialize Git (if starting fresh)
git init

# Copy provided files into this directory:
# - qr-checkin-frontend.jsx
# - qr-server-api.js
# - package.json
# - .env.example
```

### Step 2: Setup PostgreSQL Locally

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb checkin_db
createuser checkin_user -P  # Set password to 'secure_password'
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb checkin_db
sudo -u postgres createuser checkin_user -P
# Modify /etc/postgresql/15/main/postgresql.conf if needed
sudo systemctl restart postgresql
```

**Windows:**
- Download PostgreSQL installer from https://www.postgresql.org/download/windows/
- Run installer, set password during installation
- Open pgAdmin 4 and create database `checkin_db`

### Step 3: Environment Setup

```bash
# Copy template
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor

# Verify PostgreSQL connection
psql -h localhost -U checkin_user -d checkin_db -c "SELECT NOW();"
```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Start Development Server

```bash
npm start
# Output:
# ✓ QR Check-in Server running on port 3000
# • API: http://localhost:3000/api
# • Health: http://localhost:3000/api/health
```

### Step 6: Test API Health

```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok","database":"connected","timestamp":"..."}
```

### Step 7: Frontend Integration

In your React/Next.js app:
```bash
npm install react-qr-code-library  # For QR scanning
```

Then import the frontend component:
```jsx
import QRCheckInSystem from './qr-checkin-frontend'

export default function App() {
  return <QRCheckInSystem />
}
```

---

## 🐳 DOCKER DEPLOYMENT (Production)

### Step 1: Prepare Environment

```bash
# Copy and customize
cp .env.example .env

# Edit for production
nano .env

# Key changes for production:
DB_PASSWORD=your_very_secure_password
ADMIN_KEY=your_admin_secret_key
NODE_ENV=production
```

### Step 2: Create Nginx Config (Optional)

Create `nginx.conf`:
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3000;
    }

    server {
        listen 80;
        server_name localhost;

        client_max_body_size 10M;

        location /api {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location / {
            root /usr/share/nginx/html;
            try_files $uri /index.html;
        }
    }
}
```

### Step 3: Build & Start Containers

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f postgres

# Check health
docker-compose ps
```

### Step 4: Verify Deployment

```bash
# Test API from host
curl http://localhost:3000/api/health

# Access database directly
docker-compose exec postgres psql -U checkin_user -d checkin_db -c "\dt"

# View all attendee data
docker-compose exec postgres psql -U checkin_user -d checkin_db \
  -c "SELECT * FROM attendees;"
```

### Step 5: Backup & Restore Database

**Backup:**
```bash
docker-compose exec postgres pg_dump -U checkin_user checkin_db > backup.sql
```

**Restore:**
```bash
docker-compose exec -T postgres psql -U checkin_user checkin_db < backup.sql
```

### Step 6: Stop & Cleanup

```bash
# Stop all services
docker-compose down

# Remove all data (WARNING: destructive)
docker-compose down -v

# View persistent volumes
docker volume ls
```

---

## 📡 API ENDPOINTS REFERENCE

### Health & Status
**GET** `/api/health`
- Check system status
- **Response:** `{ status: "ok", database: "connected", timestamp: "..." }`

### Check-in Management
**POST** `/api/checkins`
- Register new attendee
- **Body:** `{ name, email, phone, category, online }`
- **Response:** `{ success: true, data: { id, name, email, ... } }`

**GET** `/api/attendees`
- List all checked-in attendees
- **Query Params:** `?category=Participant&limit=50&offset=0`
- **Response:** `{ attendees: [...], total: 450, limit, offset }`

### Statistics
**GET** `/api/statistics`
- Get aggregated check-in stats
- **Response:** 
```json
{
  "summary": {
    "total": "450",
    "synced": "445",
    "pending": "5",
    "categories": "8"
  },
  "by_category": [
    { "category": "Speaker", "count": "12" },
    { "category": "Youth", "count": "438" }
  ]
}
```

### Data Export
**GET** `/api/export/csv`
- Download all attendees as CSV file

**GET** `/api/export/json`
- Download all attendees as JSON file

### Admin Functions
**PUT** `/api/attendees/:id`
- Update attendee metadata
- **Header:** `X-Admin-Key: your_admin_key`

**DELETE** `/api/admin/clear`
- Clear all data (WARNING: destructive)
- **Header:** `X-Admin-Key: your_admin_key`

---

## 🔲 QR CODE GENERATION

### Option 1: Quick Online Tool
1. Go to https://www.qr-code-generator.com/
2. Data format: `John Doe|john@example.com|+255787576900|Speaker`
3. Download as PNG/SVG

### Option 2: Node.js QR Library
```bash
npm install qrcode
```

```javascript
const QRCode = require('qrcode');

const data = 'John Doe|john@example.com|+255787576900|Speaker';
QRCode.toFile('qr.png', data, { width: 200 }, (err) => {
  if (!err) console.log('QR code generated!');
});
```

### Option 3: Batch Generation Script
```javascript
// qr-generator.js
const QRCode = require('qrcode');
const attendees = [
  { name: 'John Doe', email: 'john@example.com', phone: '+255...', category: 'Speaker' },
  // ... more attendees
];

attendees.forEach((att) => {
  const data = `${att.name}|${att.email}|${att.phone}|${att.category}`;
  QRCode.toFile(`qr-${att.email}.png`, data);
});
```

---

## 🔌 OFFLINE-FIRST FEATURES

### Frontend Offline Support
✅ **LocalStorage Persistence**
- All scans saved to browser storage
- Accessible even without internet

✅ **Auto-sync on Reconnection**
- Queued offline scans automatically sync when online
- Status indicator shows sync state

✅ **Data Export**
- Export scanned data as CSV/JSON even offline
- No backend required for offline export

### Backend Sync Handling
✅ **Graceful Offline Detection**
```javascript
// Frontend
if (isOnline) {
  syncToBackend(newAttendee);  // Send to server
} else {
  localStorage.setItem('qrScans', JSON.stringify(updated));  // Save locally
}
```

✅ **Database Sync Status**
```sql
SELECT * FROM attendees WHERE synced_at IS NULL;  -- Pending syncs
```

---

## 🔍 TESTING & VALIDATION

### Unit Test Example
```bash
# Test API with curl
curl -X POST http://localhost:3000/api/checkins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+255123456789",
    "category": "Participant",
    "online": true
  }'
```

### Load Testing
```bash
# Install Apache Bench
npm install -g autocannon

# Run load test
autocannon -d 30 -c 100 http://localhost:3000/api/attendees
```

---

## 🚨 TROUBLESHOOTING

### "Connection refused" to PostgreSQL
**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Or start it
sudo systemctl start postgresql

# Verify port 5432
netstat -tulpn | grep 5432
```

### "Database not found" error
**Solution:**
```bash
psql -U checkin_user -c "CREATE DATABASE checkin_db;"
```

### Docker container won't start
**Solution:**
```bash
# Check logs
docker-compose logs api

# Rebuild containers
docker-compose build --no-cache
docker-compose up
```

### QR Scanner not working
**Checklist:**
- [ ] Browser has camera permission
- [ ] Using HTTPS or localhost (required for camera access)
- [ ] Using Chrome/Firefox/Safari (not older browsers)
- [ ] Device has a camera

**Fallback to manual entry** if camera unavailable

### Slow check-in processing
**Optimization:**
```sql
-- Add indexes if missing
CREATE INDEX idx_email ON attendees(email);
CREATE INDEX idx_event ON attendees(event_id);
```

---

## 📊 DATABASE SCHEMA

### attendees Table
```sql
CREATE TABLE attendees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  category VARCHAR(100),
  event_id VARCHAR(50) DEFAULT 'africa2026',
  checked_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### checkins_log Table
```sql
CREATE TABLE checkins_log (
  id SERIAL PRIMARY KEY,
  attendee_id INT REFERENCES attendees(id),
  check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  location VARCHAR(255),
  device_id VARCHAR(255),
  ip_address INET,
  status VARCHAR(50) DEFAULT 'success'
);
```

---

## 🔐 SECURITY BEST PRACTICES

✅ **HTTPS in Production**
```bash
# Use Let's Encrypt with Nginx
sudo apt-get install certbot
sudo certbot certonly --webroot -w /var/www/html -d yourdomain.com
```

✅ **Secure Database Password**
- Change default password in `.env`
- Use 16+ character random string

✅ **CORS Configuration**
- Restrict to known domains only
- Update in express middleware

✅ **Environment Variables**
- Never commit `.env` file
- Use `.env.example` as template
- Rotate `ADMIN_KEY` regularly

---

## 📞 SUPPORT CONTACTS

**Event Details:**
- Event: 2026 Africa Convention
- Theme: "Doing Business and Bearing Fruitful"
- Venue: Arusha, Tanzania
- Dates: 18th-22nd June, 2026
- WhatsApp: +255 787 576 900 | +255 713 276 655
- Website: www.livinghope.or.tz
- Email: wccm.tz@gmail.com

---

## 📝 VERSION HISTORY

- **v1.0.0** (June 2026) - Initial release
  - QR scanner with offline mode
  - PostgreSQL native backend
  - Docker Compose deployment
  - CSV/JSON export

---

**Last Updated:** May 6, 2026
**Documentation Version:** 1.0
