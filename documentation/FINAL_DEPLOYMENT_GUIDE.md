# 🎊 AFRICA CONVENTION 2026 - FINAL DEPLOYMENT GUIDE
## Complete System with All Images Integrated

---

## WHAT YOU HAVE

### Files Ready for Deployment:
1. **complete-system-with-images.js** - Complete system with image integration
2. **africa-convention-training.html** - Training academy
3. **11 Event Images** - All JPEG images provided
4. **Integration Guide** - This document

### Images Included:
```
✓ bronchour.jpeg (1280x904px) - Main brochure/banner
✓ Bronchour_footer.jpeg (1600x586px) - Footer brochure
✓ Doing_Business_Bronchour.jpeg (763x108px) - Theme text
✓ inside_church_bg_1.jpeg (1280x720px) - Church interior 1
✓ inside_church_bg_2.jpeg (1280x720px) - Church interior 2
✓ inside_church_bg_3.jpeg (1280x720px) - Church interior 3
✓ Venue_1.jpeg (1280x960px) - Venue exterior 1
✓ Venue_2.jpeg (720x1280px) - Venue exterior 2
✓ Venue_3.jpeg (1280x720px) - Venue exterior 3
✓ Venue_cornerstone_address.jpeg (810x1080px) - Cornerstone address
✓ youth_Summit_bronchour.jpeg - Youth Summit brochure
```

---

## STEP-BY-STEP DEPLOYMENT (15 MINUTES)

### STEP 1: Copy Complete System File
```powershell
cd C:\AfricaConvention

# Backup old API (optional but recommended)
Copy-Item "qr-server-api.js" -Destination "qr-server-api.backup.js" -Force

# Copy new complete system
Copy-Item "complete-system-with-images.js" `
  -Destination "qr-server-api.js" -Force

# Verify
if (Test-Path "qr-server-api.js") {
  Write-Host "✓ Complete system file deployed"
  $size = (Get-Item "qr-server-api.js").Length / 1KB
  Write-Host "  File size: $($size)KB"
}
```

### STEP 2: Create Directory Structure
```powershell
# Create necessary directories
New-Item -ItemType Directory -Path "documentation" -Force | Out-Null
New-Item -ItemType Directory -Path "sysimages" -Force | Out-Null
New-Item -ItemType Directory -Path "sysimages/sponsors" -Force | Out-Null

# Verify
Write-Host "✓ Directories created:"
if (Test-Path "documentation") { Write-Host "  ✓ documentation/" }
if (Test-Path "sysimages") { Write-Host "  ✓ sysimages/" }
if (Test-Path "sysimages/sponsors") { Write-Host "  ✓ sysimages/sponsors/" }
```

### STEP 3: Copy Training Academy
```powershell
# Place training file
Copy-Item "africa-convention-training.html" `
  -Destination "documentation/training.html" -Force

# Verify
if (Test-Path "documentation/training.html") {
  Write-Host "✓ Training academy installed"
  $size = (Get-Item "documentation/training.html").Length / 1KB
  Write-Host "  File size: $($size)KB"
}
```

### STEP 4: Copy All Event Images
```powershell
# Copy all JPEG images to sysimages folder
$images = @(
  "bronchour.jpeg",
  "Bronchour_footer.jpeg",
  "Doing_Business_Bronchour.jpeg",
  "inside_church_bg_1.jpeg",
  "inside_church_bg_2.jpeg",
  "inside_church_bg_3.jpeg",
  "Venue_1.jpeg",
  "Venue_2.jpeg",
  "Venue_3.jpeg",
  "Venue_cornerstone_address.jpeg",
  "youth_Summit_bronchour.jpeg"
)

Write-Host "Copying event images..."
foreach ($image in $images) {
  Copy-Item $image -Destination "sysimages/$image" -Force
  if (Test-Path "sysimages/$image") {
    $size = (Get-Item "sysimages/$image").Length / 1KB
    Write-Host "  ✓ $image ($($size)KB)"
  }
}
```

### STEP 5: Add Sponsor Logos (Optional - When You Have Them)
```powershell
# When you have sponsor logos, copy with sponsor- prefix
# Example:
Copy-Item "wccm-logo.png" `
  -Destination "sysimages/sponsors/sponsor-WCCM.png" -Force

Copy-Item "livinghope-logo.png" `
  -Destination "sysimages/sponsors/sponsor-LivingHope.png" -Force

Copy-Item "ywam-logo.png" `
  -Destination "sysimages/sponsors/sponsor-YWAM.png" -Force

# Verify sponsors
Write-Host "✓ Sponsors installed:"
Get-ChildItem "sysimages/sponsors/" | ForEach-Object { 
  $size = $_.Length / 1KB
  Write-Host "  ✓ $($_.Name) ($($size)KB)" 
}
```

### STEP 6: Stop Old Containers & Rebuild
```powershell
# Stop running containers
docker-compose stop qr-api
Write-Host "✓ Stopped old API"

# Wait 5 seconds
Start-Sleep -Seconds 5

# Rebuild with new code
Write-Host "Building Docker image (this takes 15-20 seconds)..."
docker-compose up -d --build

# Wait for build
Start-Sleep -Seconds 20

# Verify
docker-compose ps
```

Expected output:
```
NAME                 STATUS
shared-db            Up
qr-checkin-api       Up
supervisor-dashboard Up
```

### STEP 7: Verify System is Running
```powershell
# Check logs
docker-compose logs qr-api --tail 30

# Should show:
# ═══════════════════════════════════════════════════════════
#   🎊 AFRICA CONVENTION 2026 - EVENT MANAGEMENT SYSTEM
# ═══════════════════════════════════════════════════════════
#   ✓ Server: http://localhost:3000
#   ✓ Features: Dashboard | Gallery | Check-in | Badges
#   ✓ Images: Fully integrated
#   ✓ Sponsors: Auto-loading
# ═══════════════════════════════════════════════════════════
```

### STEP 8: Open Dashboard
```
Open Browser: http://localhost:3000
Hard Refresh: Ctrl+Shift+Delete
```

---

## FILE STRUCTURE (Final)

```
C:\AfricaConvention\
│
├── qr-server-api.js               ✓ New complete system
├── docker-compose.yml
├── Dockerfile.qr
├── package.json
│
├── documentation/
│   └── training.html              ✓ Training academy
│
└── sysimages/
    ├── bronchour.jpeg             ✓ Main banner
    ├── Bronchour_footer.jpeg      ✓ Footer
    ├── inside_church_bg_1.jpeg    ✓ Church interior 1
    ├── inside_church_bg_2.jpeg    ✓ Church interior 2
    ├── inside_church_bg_3.jpeg    ✓ Church interior 3
    ├── Venue_1.jpeg               ✓ Venue exterior 1
    ├── Venue_2.jpeg               ✓ Venue exterior 2
    ├── Venue_3.jpeg               ✓ Venue exterior 3
    ├── Venue_cornerstone_address.jpeg ✓ Cornerstone
    ├── youth_Summit_bronchour.jpeg ✓ Youth summit
    ├── Doing_Business_Bronchour.jpeg ✓ Theme text
    │
    └── sponsors/
        ├── sponsor-WCCM.png       (when you have)
        ├── sponsor-LivingHope.png (when you have)
        ├── sponsor-YWAM.png       (when you have)
        └── sponsor-[more].png     (when you have)
```

---

## WHAT YOU'LL SEE

### Header Section
```
Logo area (for future WCCM/LivingHope/YWAM logos)
↓
"Africa Convention 2026"
"Theme: Doing Business and Bearing Fruitful"
↓
Large Beautiful Brochure Image (bronchour.jpeg)
```

### 6 Tabs
1. **📊 Dashboard** - Real-time statistics
2. **🖼️ Gallery** - All 7 venue images + 2 brochures
3. **✅ Check-in** - Registration & check-in system
4. **🎫 Badges** - Badge generation
5. **📈 Statistics** - Analytics & reporting
6. **🎓 Academy** - Complete training guide

### Gallery Tab Features
```
Event Venue & Photos:
┌──────────┬──────────┬──────────┐
│ Venue 1  │ Corner   │ Interior │
├──────────┼──────────┼──────────┤
│ Interior │ Interior │ Interior │
├──────────┼──────────┼──────────┤
│ Venue 2  │ Venue 3  │ Entrance │
└──────────┴──────────┴──────────┘

Event Brochures:
┌──────────┬──────────┐
│ Youth    │ Event    │
│ Summit   │ Info     │
└──────────┴──────────┘
```

### Sponsor Footer (8 Columns)
```
🤝 Event Partners & Sponsors

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Logo 1 │ │ Logo 2 │ │ Logo 3 │ │ Logo 4 │ │ Logo 5 │ │ Logo 6 │ │ Logo 7 │ │ Logo 8 │
├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤
│ Name 1 │ │ Name 2 │ │ Name 3 │ │ Name 4 │ │ Name 5 │ │ Name 6 │ │ Name 7 │ │ Name 8 │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

### Copyright Footer
```
© 2026 Africa Convention - Event Management System
Designed by: raphayelchas@gmail.com
Organized by: Living Hope Mission | WCCM | YWAM | Arusha, Tanzania
June 18-22, 2026 | Theme: "Doing Business and Bearing Fruitful"
```

---

## QUICK DEPLOYMENT SCRIPT (All-in-One)

Copy and paste this entire block:

```powershell
# AFRICA CONVENTION 2026 - COMPLETE DEPLOYMENT
# Run in PowerShell as Administrator

$ErrorActionPreference = "Stop"
cd C:\AfricaConvention

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "AFRICA CONVENTION 2026 - SYSTEM DEPLOYMENT" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Directories
Write-Host "`n[1/6] Creating directories..." -ForegroundColor Green
New-Item -ItemType Directory -Path "documentation" -Force | Out-Null
New-Item -ItemType Directory -Path "sysimages" -Force | Out-Null
New-Item -ItemType Directory -Path "sysimages/sponsors" -Force | Out-Null
Write-Host "✓ Directories created"

# Step 2: Training
Write-Host "`n[2/6] Installing training academy..." -ForegroundColor Green
Copy-Item "africa-convention-training.html" -Destination "documentation/training.html" -Force
Write-Host "✓ Training academy installed"

# Step 3: Images
Write-Host "`n[3/6] Copying event images..." -ForegroundColor Green
$images = @("bronchour.jpeg","Bronchour_footer.jpeg","Doing_Business_Bronchour.jpeg","inside_church_bg_1.jpeg","inside_church_bg_2.jpeg","inside_church_bg_3.jpeg","Venue_1.jpeg","Venue_2.jpeg","Venue_3.jpeg","Venue_cornerstone_address.jpeg","youth_Summit_bronchour.jpeg")
foreach ($image in $images) {
  if (Test-Path $image) {
    Copy-Item $image -Destination "sysimages/$image" -Force
    Write-Host "  ✓ $image"
  }
}

# Step 4: Deploy API
Write-Host "`n[4/6] Deploying complete system..." -ForegroundColor Green
Copy-Item "qr-server-api.js" -Destination "qr-server-api.backup.js" -Force
Copy-Item "complete-system-with-images.js" -Destination "qr-server-api.js" -Force
Write-Host "✓ System deployed"

# Step 5: Rebuild Docker
Write-Host "`n[5/6] Rebuilding Docker containers..." -ForegroundColor Green
docker-compose stop qr-api
docker-compose up -d --build
Write-Host "⏳ Building (15-20 seconds)..."
Start-Sleep -Seconds 20

# Step 6: Verify
Write-Host "`n[6/6] Verifying system..." -ForegroundColor Green
docker-compose ps

Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✓ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nDashboard: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Press Ctrl+Shift+Delete to hard refresh browser" -ForegroundColor Yellow
Write-Host "`nTabs:"
Write-Host "  📊 Dashboard - Real-time statistics"
Write-Host "  🖼️ Gallery - Event photos & venue"
Write-Host "  ✅ Check-in - Registration & operations"
Write-Host "  🎫 Badges - Badge generation"
Write-Host "  📈 Statistics - Analytics"
Write-Host "  🎓 Academy - Training guide"
Write-Host "`nFooter:"
Write-Host "  🤝 Sponsor logos (8-column layout)"
Write-Host "  © Copyright: raphayelchas@gmail.com"
Write-Host "`n════════════════════════════════════════════════════════" -ForegroundColor Cyan
```

---

## TESTING CHECKLIST

After deployment, verify each feature:

```
SYSTEM STARTUP
□ All Docker containers running (docker-compose ps)
□ No errors in logs (docker-compose logs qr-api)
□ Dashboard loads at http://localhost:3000

VISUAL ELEMENTS
□ Header displays properly
□ Main brochure image (bronchour.jpeg) shows in header
□ All 6 tabs visible
□ Footer displays copyright notice

GALLERY TAB (🖼️)
□ All 7 venue images load
  ✓ Venue_1.jpeg
  ✓ Venue_cornerstone_address.jpeg
  ✓ inside_church_bg_1.jpeg
  ✓ inside_church_bg_2.jpeg
  ✓ inside_church_bg_3.jpeg
  ✓ Venue_2.jpeg
  ✓ Venue_3.jpeg
□ Both brochures load
  ✓ youth_Summit_bronchour.jpeg
  ✓ Bronchour_footer.jpeg
□ Images are optimized size
□ Captions display correctly

DASHBOARD TAB (📊)
□ Statistics cards load
□ Real-time activity log works
□ Category breakdown shows
□ Auto-refresh every 5 seconds

CHECK-IN TAB (✅)
□ Registration form works
□ Can enter attendee info
□ Can check in with QR
□ Can check out
□ Activity log updates

BADGES TAB (🎫)
□ Can select attendees
□ Can generate PDF
□ Can generate HTML

STATISTICS TAB (📈)
□ Metrics display
□ Progress bars show
□ Detailed table loads

ACADEMY TAB (🎓)
□ Training content loads
□ Can scroll through sections
□ FAQ items expandable
□ Contact info visible

FOOTER
□ Copyright displays:
  "Designed by: raphayelchas@gmail.com"
□ (When sponsors added) Sponsor logos in 8-column grid

DATABASE
□ Can add attendees
□ Check-in records timestamp
□ Statistics update in real-time
```

---

## TROUBLESHOOTING

### Images not showing
```powershell
# Verify images are in correct location
Get-ChildItem "sysimages/" -Recurse

# Should show all 11 JPEG files
# If missing, copy them again from outputs folder
```

### System won't start
```powershell
# Check Docker logs
docker-compose logs qr-api

# Full rebuild
docker-compose down
docker-compose up -d --build
Start-Sleep -Seconds 20
docker-compose ps
```

### Gallery showing broken images
```powershell
# Restart Docker
docker-compose restart qr-api
Start-Sleep -Seconds 10

# Hard refresh browser: Ctrl+Shift+Delete
```

---

## NEXT STEPS

### When You Have Sponsor Logos
```powershell
# Copy sponsor logos with naming convention
Copy-Item "WCCM-logo.png" -Destination "sysimages/sponsors/sponsor-WCCM.png"
Copy-Item "LivingHope-logo.png" -Destination "sysimages/sponsors/sponsor-LivingHope.png"
Copy-Item "YWAM-logo.png" -Destination "sysimages/sponsors/sponsor-YWAM.png"

# No restart needed! Sponsors appear automatically in footer
# Just refresh the browser
```

### For Training Staff
```
1. Open http://localhost:3000
2. Click 🎓 Academy tab
3. Share link with staff
4. Print Academy section for reference
```

### For Daily Operations
```
1. Open http://localhost:3000
2. Use Check-in tab during event
3. Monitor Dashboard for statistics
4. Generate badges before/during event
5. Review Statistics for reporting
```

---

## FINAL FILE STRUCTURE

```
C:\AfricaConvention\
│
├── ✓ qr-server-api.js             (NEW - complete system)
├── ✓ qr-server-api.backup.js      (OLD - backup)
├── docker-compose.yml
├── Dockerfile.qr
├── package.json
│
├── ✓ documentation/
│   └── ✓ training.html            (10 sections, FAQ, contacts)
│
└── ✓ sysimages/
    ├── ✓ bronchour.jpeg           (Main banner - 1280x904px)
    ├── ✓ Bronchour_footer.jpeg    (Footer - 1600x586px)
    ├── ✓ Doing_Business_Bronchour.jpeg (Theme text)
    ├── ✓ inside_church_bg_1.jpeg  (Interior - 1280x720px)
    ├── ✓ inside_church_bg_2.jpeg  (Interior - 1280x720px)
    ├── ✓ inside_church_bg_3.jpeg  (Interior - 1280x720px)
    ├── ✓ Venue_1.jpeg             (Exterior - 1280x960px)
    ├── ✓ Venue_2.jpeg             (Exterior - 720x1280px)
    ├── ✓ Venue_3.jpeg             (Exterior - 1280x720px)
    ├── ✓ Venue_cornerstone_address.jpeg (Cornerstone - 810x1080px)
    ├── ✓ youth_Summit_bronchour.jpeg (Youth Summit)
    │
    └── sponsors/                    (Add JPEG logos as needed)
        └── sponsor-[Name].jpeg     (8-column footer layout)
```

---

## SUCCESS INDICATORS

✅ System is ready when:
- [x] All Docker containers show "Up"
- [x] Dashboard loads without errors
- [x] All 6 tabs functional
- [x] Gallery shows all venue images
- [x] Check-in operations work
- [x] Timestamps record correctly
- [x] Badges generate successfully
- [x] Training Academy displays
- [x] Footer shows copyright
- [x] (Optional) Sponsor logos visible

---

## SUPPORT CONTACTS

**During Deployment:**
- Check logs: `docker-compose logs qr-api`
- Restart: `docker-compose restart qr-api`

**During Event:**
- Check-in support: Use Academy tab
- System issues: Monitor Docker logs
- Data backup: Run manual backup

**Organizer Contacts:**
- Phone: +255 787 576 900
- Phone: +255 713 276 655
- Email: wccm.tz@gmail.com
- Website: www.livinghope.or.tz

---

## 🎊 AFRICA CONVENTION 2026 - SYSTEM READY FOR DEPLOYMENT!

**Estimated Setup Time: 15 minutes**
**Expected Attendees: 400-600**
**Event Dates: June 18-22, 2026**
**Location: Arusha, Tanzania**
**Theme: "Doing Business and Bearing Fruitful"**

---

*Complete system with images | Training included | Sponsors ready | Copyright: raphayelchas@gmail.com*
