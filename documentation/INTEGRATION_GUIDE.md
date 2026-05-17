# 🚀 AFRICA CONVENTION 2026 - COMPLETE INTEGRATION GUIDE

## PART 1: DIRECTORY STRUCTURE SETUP

### Step 1.1: Create Project Directories

```powershell
cd C:\AfricaConvention

# Create all required directories
New-Item -ItemType Directory -Path "documentation" -Force
New-Item -ItemType Directory -Path "sysimages" -Force
New-Item -ItemType Directory -Path "sysimages/sponsors" -Force

# Verify directories were created
Write-Host "Checking directories..."
if (Test-Path "documentation") { Write-Host "✓ documentation folder created" }
if (Test-Path "sysimages") { Write-Host "✓ sysimages folder created" }
if (Test-Path "sysimages/sponsors") { Write-Host "✓ sponsors folder created" }
```

**Expected Result:**
```
C:\AfricaConvention\
├── documentation/          ← Created
├── sysimages/              ← Created
│   └── sponsors/           ← Created
└── [existing files]
```

---

## PART 2: ADD TRAINING DOCUMENTATION

### Step 2.1: Place Training File

```powershell
# You should have downloaded: africa-convention-training.html

# Copy it to the documentation folder
Copy-Item "africa-convention-training.html" `
  -Destination "documentation/training.html" `
  -Force

# Verify
if (Test-Path "documentation/training.html") {
  Write-Host "✓ Training documentation installed"
} else {
  Write-Host "✗ Training file not found"
}
```

**File Structure Now:**
```
C:\AfricaConvention\
├── documentation/
│   └── training.html        ← Training Academy content
└── sysimages/
    └── sponsors/
```

---

## PART 3: ADD IMAGES & LOGOS (WHEN YOU HAVE THEM)

### Step 3.1: Event Logo (Optional)

When you provide your event logo:

```powershell
# Copy your event logo to sysimages folder
# Acceptable formats: .png or .jpg
# Recommended size: 150px width × 60px height

Copy-Item "your-event-logo.png" -Destination "sysimages/event-logo.png" -Force

# Verify
if (Test-Path "sysimages/event-logo.png") {
  Write-Host "✓ Event logo installed"
}
```

**Result:** Logo appears in top-right of header

### Step 3.2: Sponsor Logos

When you provide sponsor logos, name them with `sponsor-` prefix:

```powershell
# Copy each sponsor logo with naming convention
# Format: sponsor-[ORGANIZATION_NAME].png

Copy-Item "LivingHope_logo.png" `
  -Destination "sysimages/sponsors/sponsor-LivingHope.png" -Force

Copy-Item "WCCM_logo.png" `
  -Destination "sysimages/sponsors/sponsor-WCCM.png" -Force

Copy-Item "YWAM_logo.png" `
  -Destination "sysimages/sponsors/sponsor-YWAM.png" -Force

# Add more sponsors as needed...

# Verify all sponsors
Write-Host "Sponsors installed:"
Get-ChildItem "sysimages/sponsors/" | ForEach-Object { 
  Write-Host "✓ $($_.Name)" 
}
```

**Naming Convention (IMPORTANT):**
- ✓ `sponsor-LivingHope.png` ← Correct
- ✓ `sponsor-WCCM.png` ← Correct
- ✓ `sponsor-MyOrganization.jpg` ← Correct
- ✗ `LivingHope.png` ← WRONG (no sponsor- prefix)
- ✗ `logo.png` ← WRONG (not descriptive)

**Result:** Sponsors appear in footer automatically

### Step 3.3: Attendee Photos (Optional - Future)

When you have attendee photos:

```powershell
# Format: photo-[ATTENDEE_ID].jpg
# These will integrate with badges in future builds

Copy-Item "john_mwangi.jpg" -Destination "sysimages/photo-1.jpg" -Force
Copy-Item "jane_kipkemboi.jpg" -Destination "sysimages/photo-2.jpg" -Force

# Keep file structure
# sysimages/
#   ├── photo-1.jpg
#   ├── photo-2.jpg
#   └── sponsors/
```

**File Structure After All Steps:**
```
C:\AfricaConvention\
├── documentation/
│   └── training.html
├── sysimages/
│   ├── event-logo.png (optional)
│   ├── photo-1.jpg (optional)
│   ├── photo-2.jpg (optional)
│   └── sponsors/
│       ├── sponsor-LivingHope.png
│       ├── sponsor-WCCM.png
│       ├── sponsor-YWAM.png
│       └── sponsor-[more].png
```

---

## PART 4: DEPLOY SYSTEM

### Step 4.1: Prepare New API File

```powershell
cd C:\AfricaConvention

# Stop the current API
docker-compose stop qr-api

# Remove old API file
Remove-Item "qr-server-api.js" -Force -ErrorAction SilentlyContinue

# Copy the new API
# You should have downloaded: complete-system-final.js
Copy-Item "complete-system-final.js" -Destination "qr-server-api.js" -Force

# Verify
if (Test-Path "qr-server-api.js") {
  Write-Host "✓ New API deployed"
  $size = (Get-Item "qr-server-api.js").Length
  Write-Host "  File size: $($size / 1KB)KB"
}
```

### Step 4.2: Rebuild Docker Image

```powershell
# Build with new API
docker-compose up -d --build

# Wait for build to complete
Write-Host "Building Docker image... (this takes 15-20 seconds)"
Start-Sleep -Seconds 20

# Check container status
Write-Host "`nContainer Status:"
docker-compose ps
```

**Expected Output:**
```
NAME                 STATUS
shared-db            Up
qr-checkin-api       Up
supervisor-dashboard Up
```

### Step 4.3: Verify System is Running

```powershell
# Check logs
docker-compose logs qr-api -f --tail 50

# You should see:
# ═══════════════════════════════════════════════════════════
#   🎊 AFRICA CONVENTION 2026 - EVENT MANAGEMENT SYSTEM
# ═══════════════════════════════════════════════════════════
#   ✓ Server running on port: 3000
#   ✓ Dashboard: http://localhost:3000
#   ✓ Training Academy: Embedded in Dashboard
#   ✓ Image Support: /sysimages directory
#   ✓ Documentation: /documentation directory
#   ✓ Sponsor Logos: /sysimages/sponsors directory
# ═══════════════════════════════════════════════════════════
```

---

## PART 5: TEST SYSTEM

### Step 5.1: Open Dashboard

```
Open browser: http://localhost:3000
Hard Refresh: Ctrl+Shift+Delete
```

**Expected Result:** Dashboard loads with 5 tabs visible

### Step 5.2: Verify Database Connection

```powershell
# Check database connection
docker exec -it shared-db psql -U admin -d africa_convention `
  -c "SELECT COUNT(*) as attendee_count FROM attendees;"

# Should show count of attendees
# Example: 
#  attendee_count
#  ──────────────
#         15
```

### Step 5.3: Test Each Tab

#### TAB 1: 📊 Dashboard
```
✓ See statistics cards (Total, In Event, Checked Out, Rate %)
✓ See recent activity log
✓ See category breakdown
✓ All data should be real-time
```

#### TAB 2: ✅ Check-in/Check-out
```
✓ Register form loads with fields
✓ Can enter attendee data
✓ QR scan field works
✓ Check in button works
✓ Check out button works
```

#### TAB 3: 🎫 Badges
```
✓ Format selection works (PDF/HTML)
✓ Attendee list loads
✓ Can select attendees
✓ Count updates when selecting
✓ Download button works
```

#### TAB 4: 📈 Statistics
```
✓ Statistics summary loads
✓ Category progress bars show
✓ Detailed table displays
✓ All data is current
```

#### TAB 5: 🎓 Academy (NEW!)
```
✓ Training content loads
✓ Can scroll through sections
✓ Table of contents works
✓ FAQ items expand/collapse
✓ Contact info displays
```

### Step 5.4: Test Image Integration

#### Event Logo (if added)
```
✓ Look at top-right of header
✓ Logo should appear if placed in /sysimages/
```

#### Sponsor Logos (if added)
```
✓ Scroll to bottom of page
✓ Should see "🤝 Event Partners & Sponsors"
✓ All sponsor logos from /sysimages/sponsors/ display
✓ Organization names appear below logos
```

---

## PART 6: ADD TEST DATA

### Step 6.1: Quick Test with Sample Data

```powershell
# Add 10 sample attendees for testing
docker exec -it shared-db psql -U admin -d africa_convention << 'EOF'
INSERT INTO attendees (name, email, phone, category, qr_code, checked_in, checked_in_at) VALUES
('Alice Mwangi', 'alice@test.com', '+255700000101', 'Youth', 'QR-001', true, NOW() - INTERVAL '2 hours'),
('Bob Kipchoge', 'bob@test.com', '+255700000102', 'Speaker', 'QR-002', true, NOW() - INTERVAL '1 hour'),
('Carol Njeri', 'carol@test.com', '+255700000103', 'Business', 'QR-003', true, NOW() - INTERVAL '30 minutes'),
('David Okonkwo', 'david@test.com', '+255700000104', 'Youth', 'QR-004', false, NULL),
('Eve Kimani', 'eve@test.com', '+255700000105', 'Speaker', 'QR-005', false, NULL),
('Frank Mugwanya', 'frank@test.com', '+255700000106', 'Business', 'QR-006', true, NOW() - INTERVAL '15 minutes'),
('Grace Ochieng', 'grace@test.com', '+255700000107', 'Youth', 'QR-007', true, NOW() - INTERVAL '10 minutes'),
('Henry Kiplagat', 'henry@test.com', '+255700000108', 'Staff', 'QR-008', true, NOW() - INTERVAL '5 minutes'),
('Iris Mutua', 'iris@test.com', '+255700000109', 'Youth', 'QR-009', false, NULL),
('James Kipchoge', 'james@test.com', '+255700000110', 'Business', 'QR-010', false, NULL);

SELECT 'Sample data inserted!' as status;
EOF
```

### Step 6.2: Refresh Dashboard to See Data

```
http://localhost:3000
Hard Refresh: Ctrl+Shift+Delete

Expected:
- Total: 10
- In Event: 6
- Waiting: 4
- Rate: 60%
```

---

## PART 7: TRAINING & DOCUMENTATION

### Step 7.1: View Training Academy

```
1. Open: http://localhost:3000
2. Click: 🎓 Academy Tab
3. Read: Complete training guide
4. Features:
   ✓ System Overview
   ✓ Core Features
   ✓ Dashboard Guide
   ✓ Check-in Operations
   ✓ Badge System
   ✓ Analytics Guide
   ✓ Daily Operations Checklist
   ✓ Troubleshooting
   ✓ 10 FAQ items
   ✓ Support contacts
```

### Step 7.2: Print Training for Staff

```
1. Open: http://localhost:3000
2. Click: 🎓 Academy Tab
3. Press: Ctrl+P (Print)
4. Save as PDF or print to paper
5. Distribute to all staff
```

---

## PART 8: TROUBLESHOOTING

### Issue: "Training Academy not loading"

```powershell
# Verify training file exists
Test-Path "documentation/training.html"

# If missing, recopy the file
Copy-Item "africa-convention-training.html" `
  -Destination "documentation/training.html" -Force

# Restart API
docker-compose restart qr-api
Start-Sleep -Seconds 10
```

### Issue: "Sponsor logos not showing"

```powershell
# Verify sponsor directory exists
Test-Path "sysimages/sponsors"

# Check files in sponsors folder
Get-ChildItem "sysimages/sponsors/"

# All files must start with "sponsor-"
# Examples that work:
#   sponsor-LivingHope.png ✓
#   sponsor-WCCM.png ✓
#   sponsor-YWAM.png ✓

# Examples that DON'T work:
#   LivingHope.png ✗
#   logo.png ✗
```

### Issue: "Event logo not showing"

```powershell
# Verify logo file exists in sysimages
Test-Path "sysimages/event-logo.png"

# File must be named exactly "event-logo.png" or "event-logo.jpg"
# Not "logo.png" or "event_logo.png"

# If wrong name, rename it
Rename-Item "sysimages/your-logo.png" -NewName "event-logo.png"
```

### Issue: "Database shows old data"

```powershell
# Clear all attendee data
docker exec -it shared-db psql -U admin -d africa_convention `
  -c "TRUNCATE TABLE attendees RESTART IDENTITY;"

# Reload fresh data
# (See Step 6.1)
```

---

## PART 9: MAINTENANCE & UPDATES

### Regular Backups

```powershell
# Backup database daily
docker exec shared-db pg_dump -U admin -d africa_convention `
  > "backup_$(Get-Date -Format 'yyyyMMdd').sql"

Write-Host "Backup created: backup_$(Get-Date -Format 'yyyyMMdd').sql"
```

### Update Training Documentation

```powershell
# 1. Edit: documentation/training.html
# 2. Save
# 3. Restart API
docker-compose restart qr-api

# New version loads automatically
```

### Add New Sponsor Mid-Event

```powershell
# 1. Copy new sponsor logo to sysimages/sponsors/
Copy-Item "NewSponsor_logo.png" `
  -Destination "sysimages/sponsors/sponsor-NewSponsor.png"

# 2. Refresh browser (no restart needed!)
# Logo appears automatically in footer
```

---

## PART 10: QUICK REFERENCE COMMANDS

### System Management

```powershell
# Start system
docker-compose up -d

# Stop system
docker-compose stop

# Restart API
docker-compose restart qr-api

# View logs
docker-compose logs qr-api -f

# Full rebuild
docker-compose down
docker-compose up -d --build

# Status check
docker-compose ps

# Open dashboard
start http://localhost:3000
```

### Database Operations

```powershell
# Connect to database
docker exec -it shared-db psql -U admin -d africa_convention

# Count attendees
docker exec -it shared-db psql -U admin -d africa_convention `
  -c "SELECT COUNT(*) FROM attendees;"

# See recent check-ins
docker exec -it shared-db psql -U admin -d africa_convention `
  -c "SELECT name, checked_in_at FROM attendees WHERE checked_in = true ORDER BY checked_in_at DESC LIMIT 10;"

# Clear all data
docker exec -it shared-db psql -U admin -d africa_convention `
  -c "TRUNCATE TABLE attendees RESTART IDENTITY;"
```

### File Operations

```powershell
# Check directory structure
tree.com /F /A C:\AfricaConvention

# List images
Get-ChildItem "sysimages/" -Recurse

# List sponsors
Get-ChildItem "sysimages/sponsors/"

# Check training file
Test-Path "documentation/training.html"
```

---

## FINAL CHECKLIST

Before going live for the event:

```
□ Directory structure created (documentation/, sysimages/)
□ Training documentation placed (documentation/training.html)
□ Event logo added (optional but recommended)
□ All sponsor logos added with sponsor- prefix
□ Docker containers running (docker-compose ps shows all Up)
□ Dashboard loads at http://localhost:3000
□ All 5 tabs visible and working
□ Training Academy tab displays full content
□ Sponsor logos visible in footer
□ Sample test data working
□ Database connection verified
□ Staff trained on system
□ QR scanners tested
□ Backup systems in place
□ Support contacts documented

✓ SYSTEM READY FOR AFRICA CONVENTION 2026!
```

---

## SUPPORT CONTACTS

**During Event:**
- Phone 1: +255 787 576 900
- Phone 2: +255 713 276 655
- Email: wccm.tz@gmail.com

**System Support:**
- Check Training Academy tab in system
- See Troubleshooting section for common issues
- Contact system administrator for technical issues

---

**Version: 3.0.0**
**Last Updated: May 2026**
**Africa Convention 2026 - Arusha, Tanzania**
