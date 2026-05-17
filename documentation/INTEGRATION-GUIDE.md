# 🎟️ COMPLETE INTEGRATION GUIDE
## ALFIO Ticketing + QR Check-in System
## 2026 Africa Convention

---

## 📋 TABLE OF CONTENTS
1. [System Architecture](#system-architecture)
2. [How It Works Together](#how-it-works-together)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Operation](#operation)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ SYSTEM ARCHITECTURE

```
ATTENDEE JOURNEY:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ALFIO (Port 9090)          QR System (Port 3000)      │
│  ├─ Ticket Sales            ├─ QR Verification        │
│  ├─ Event Management        ├─ Check-in Recording     │
│  ├─ QR Code Generation      └─ Real-time Status       │
│  └─ Attendee Database                                  │
│         │                          │                   │
│         └──────── SHARED ─────────┘                    │
│         PostgreSQL Database (Port 5432)                │
│         └─ Single source of truth                      │
│                                                         │
│  Supervisor Dashboard (Port 4000)                      │
│  └─ Real-time monitoring of both systems              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ HOW IT WORKS TOGETHER

### **Phase 1: Registration (ALFIO)**
```
Attendee visits: http://localhost:9090
  ↓
Creates account, buys ticket
  ↓
Gets UNIQUE QR CODE (linked to ticket ID)
  ↓
QR Code saved in SHARED DATABASE
```

### **Phase 2: Check-in (QR System)**
```
At Event Entrance, Supervisor scans QR: http://localhost:3000
  ↓
QR System queries SHARED DATABASE
  ↓
Verifies attendee exists in ALFIO
  ↓
Checks for duplicate scans
  ↓
Marks as "checked-in" in database
  ↓
Updates SUPERVISOR DASHBOARD in real-time
```

### **Phase 3: Monitoring (Dashboard)**
```
Supervisor monitors: http://localhost:4000
  ↓
Sees:
  - Total registered (from ALFIO)
  - Total checked in (from QR)
  - Check-in rate percentage
  - Recent scans (live)
  - By-category breakdown
  - Timeline of check-ins
```

---

## 🚀 INSTALLATION

### **Windows PowerShell Setup**

#### **Step 1: Navigate to Project**
```powershell
cd C:\AfricaConvention
```

#### **Step 2: Backup Old Files**
```powershell
Copy-Item "docker-compose.yml" "docker-compose-BACKUP.yml"
Copy-Item ".env" ".env-BACKUP"
```

#### **Step 3: Copy New Files**

From the outputs, download and copy these to your folder:
```
docker-compose-INTEGRATED.yml    (rename to docker-compose.yml)
qr-server-integrated.js          (rename to qr-server-api.js)
supervisor-dashboard.jsx
.env-integrated                  (rename to .env)
```

#### **Step 4: Rename Files**
```powershell
Rename-Item "docker-compose-INTEGRATED.yml" "docker-compose.yml" -Force
Rename-Item "qr-server-integrated.js" "qr-server-api.js" -Force
Rename-Item ".env-integrated" ".env" -Force
```

#### **Step 5: Verify Structure**
```powershell
ls
```

You should see:
```
✅ docker-compose.yml
✅ qr-server-api.js
✅ supervisor-dashboard.jsx
✅ package.json
✅ Dockerfile
✅ .env
✅ Dockerfile.alfio (existing ALFIO Dockerfile)
```

---

## ⚙️ CONFIGURATION

### **Update .env File**

Open `.env` and verify/update:

```powershell
notepad .env
```

**Critical settings:**
```
DB_USER=admin                           # Keep as-is
DB_PASSWORD=ArushaPassword2026          # Keep as-is (ALFIO password)
DB_NAME=africa_convention               # New shared database
NODE_ENV=production                     # Production mode
ALFIO_VERIFICATION=true                 # Enable ALFIO verification
```

### **Database Connection**

The system uses ONE shared PostgreSQL database:
```
Database: africa_convention
User: admin
Password: ArushaPassword2026
Host: shared-db (internal Docker)
Port: 5432 (mapped to 5432 on host)
```

Both ALFIO and QR system access this same database.

---

## 🐳 DEPLOYMENT

### **Start All Systems**

```powershell
cd C:\AfricaConvention

# Build and start
docker-compose up -d
```

You should see:
```
Creating shared-db ... done
Creating alfio-app ... done
Creating qr-api ... done
Creating supervisor-dashboard ... done
Creating convention_reverse_proxy ... done
```

### **Wait for Services to Start** (30-45 seconds)

Check status:
```powershell
docker-compose ps
```

All should show "Up":
```
NAME                    STATUS
shared-db               Up (healthy)
alfio-app               Up
qr-api                  Up
supervisor-dashboard    Up
convention_reverse_proxy Up
```

### **Test Each System**

**ALFIO Ticketing System:**
```
http://localhost:9090
```
Should show: ALFIO login page

**QR Check-in System:**
```
http://localhost:3000
```
Should show: Blue QR scanner interface

**Supervisor Dashboard:**
```
http://localhost:4000
```
Should show: Real-time statistics and monitoring

**Shared Database:**
```
Connection: localhost:5432
User: admin
Password: ArushaPassword2026
```

---

## 📊 OPERATION WORKFLOW

### **Day 1: Pre-Event Setup**

1. **ALFIO Setup** (http://localhost:9090)
   - Create event in ALFIO
   - Configure ticket types
   - Set up pricing
   - Generate QR codes for all attendees
   - QR codes automatically saved to shared database

2. **QR System Setup** (http://localhost:3000)
   - System auto-verifies ALFIO connection
   - Database tables automatically created
   - Ready to scan

3. **Dashboard Verification** (http://localhost:4000)
   - Verify connection to both systems
   - Test real-time updates
   - Check dashboard loading

### **Day 2-5: Event Days**

**Morning:**
1. Open supervisor dashboard: http://localhost:4000
2. Monitor check-ins in real-time
3. See stats update every 5 seconds

**At Entrance:**
1. Staff have QR scanner (http://localhost:3000)
2. Attendees arrive with ticket QR code
3. Staff scans code
4. System verifies against ALFIO database
5. Attendee checked in ✓

**Live Monitoring:**
1. Supervisor watches dashboard
2. Sees real-time check-in rate
3. Identifies bottlenecks
4. Can manually check in if QR fails

---

## 🔌 API ENDPOINTS

### **QR Verification**
```
POST /api/verify-qr
Body: { "qr_code": "...", "staff_name": "John", "location": "main-entrance" }
Response: { success: true, data: { name, email, category, ... } }
```

### **Manual Check-in**
```
POST /api/checkin-manual
Body: { "email": "...", "staff_name": "John", "reason": "QR failed" }
Response: { success: true, data: {...} }
```

### **Real-time Statistics**
```
GET /api/statistics
Response: { 
  summary: { total_registered, total_checked_in, check_in_rate },
  by_category: [...],
  recent_checkins: [...]
}
```

### **Dashboard Data**
```
GET /api/dashboard
Response: { status: "live", summary: {...}, timeline: [...] }
```

### **Export Check-ins**
```
GET /api/export/checkins
Response: CSV file download
```

---

## 🎯 SUPERVISOR OPERATIONS

### **Real-time Dashboard** (http://localhost:4000)

**Top Cards Show:**
- Total Registered (from ALFIO)
- Checked In (from QR)
- Check-in Rate %
- Verified QR codes

**Middle Section:**
- Attendance by Category
  - Shows registered vs checked-in per category
  - Color-coded progress bars
  
- Check-ins by Hour
  - Timeline of check-in volume
  - Identify peak times

**Bottom Section:**
- Recent Check-ins (live updating)
- Shows last 10 scanned attendees
- Name, category, time, staff member

### **Manual Check-in**

If attendee QR fails:
```
1. Go to: http://localhost:3000
2. Click "Manual Entry"
3. Enter: Email
4. System finds attendee in ALFIO database
5. Click "Check In"
6. Dashboard updates immediately
```

### **Export Data**

After event:
```
GET http://localhost:3000/api/export/checkins
Downloads: CSV with all check-in records
```

---

## 🔍 TROUBLESHOOTING

### **ALFIO Not Starting**

Check logs:
```powershell
docker-compose logs alfio
```

Common issues:
- Database not ready: Wait 30 seconds
- Port 9090 in use: Change port in docker-compose.yml
- Memory: Increase Xmx in docker-compose

### **QR System Not Connecting to Database**

Check:
```powershell
docker-compose logs qr-api
```

Verify database is running:
```powershell
docker-compose ps | grep shared-db
# Should show "Up (healthy)"
```

### **Dashboard Shows No Data**

1. Verify database: `docker-compose logs shared-db`
2. Verify APIs: 
   - `http://localhost:3000/api/health`
   - Check response shows database connected

3. Clear browser cache and reload

### **QR Code Verification Fails**

1. Verify attendee exists in ALFIO
2. Check QR code format matches database
3. See API logs: `docker-compose logs qr-api`

### **Performance Issues**

If system is slow:
```powershell
docker stats
```

Check resource usage. If high:
- Increase Docker memory allocation
- Restart containers: `docker-compose restart`

---

## 🔒 SECURITY CHECKLIST

- [ ] Change DB_PASSWORD in .env
- [ ] Change ADMIN_KEY in .env
- [ ] Enable HTTPS in production
- [ ] Backup database daily
- [ ] Restrict API access (firewall)
- [ ] Monitor logs for errors
- [ ] Test manual check-in override

---

## 📱 ATTENDEE EXPERIENCE

### **Before Event (ALFIO)**
1. Attendee visits: http://localhost:9090
2. Purchases ticket
3. Gets unique QR code
4. Saves/prints QR code

### **At Event (QR System)**
1. Arrives with QR code (phone or printed)
2. Shows code to entrance staff
3. Staff scans with: http://localhost:3000
4. Instant confirmation
5. Gets badge/wristband
6. Enters event

### **Supervisor View (Dashboard)**
1. Opens: http://localhost:4000
2. Sees real-time stats
3. Monitors check-in flow
4. Identifies issues immediately

---

## 🎊 SUCCESS INDICATORS

✅ System working when you see:
- ALFIO page loads at port 9090
- QR scanner works at port 3000
- Dashboard updates live at port 4000
- Test scan records in database
- Export CSV downloads successfully

---

## 🆘 SUPPORT

**If something breaks:**

1. Check logs:
   ```powershell
   docker-compose logs
   docker-compose logs alfio
   docker-compose logs qr-api
   docker-compose logs shared-db
   ```

2. Restart system:
   ```powershell
   docker-compose restart
   ```

3. Full rebuild:
   ```powershell
   docker-compose down
   docker-compose up -d
   ```

---

## 📞 CONTACT

**Event Details:**
- Website: www.livinghope.or.tz
- Email: wccm.tz@gmail.com
- WhatsApp: +255 787 576 900

---

**You now have a FULLY INTEGRATED event management system!** 🚀

ALFIO handles registration & tickets
QR system handles check-in & verification
Supervisor dashboard monitors everything in real-time

One unified system for the 2026 Africa Convention.

Good luck with your event! 🎉
