# 🔍 TROUBLESHOOTING: Images & Training Not Displaying

## ⚠️ PROBLEM DESCRIPTION
- Files are in correct directories (`/sysimages/`, `/documentation/`)
- Files are properly named
- System starts but images/training don't display
- Getting placeholder images or "not found" messages

---

## 🔧 SOLUTION: Use Diagnostic Version

### Step 1: Deploy Diagnostic System

Replace your `qr-server-api.js` with the diagnostic version:

```powershell
cd C:\AfricaConvention

# Stop current system
docker-compose stop qr-api

# Copy diagnostic version
Copy-Item "complete-system-diagnostic.js" -Destination "qr-server-api.js" -Force

# Restart
docker-compose up -d --build
Start-Sleep -Seconds 20
```

### Step 2: Check Server Startup Logs

```powershell
# View startup logs
docker-compose logs qr-api

# You should see:
# 🔍 AFRICA CONVENTION 2026 - DIAGNOSTIC MODE
# Base Directory: /app
# Docs Directory: /app/documentation
# Images Directory: /app/sysimages
# 
# 📁 CHECKING DIRECTORIES:
#   documentation/ exists: TRUE/FALSE
#   sysimages/ exists: TRUE/FALSE
#
# 📄 FILES IN documentation/:
# 📜 FILES IN sysimages/:
```

**If directories show FALSE**, files aren't in Docker container.

### Step 3: Login & Use Debug Tab

```
1. Go to: http://localhost:3000
2. Login: admin / Africa2026!
3. Click: 🔧 Debug tab (bottom right)
4. Click: "Refresh Debug Info"
```

You'll see a complete file listing showing:
- What directories exist
- What files are found
- Exact paths being used

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: Directories Show FALSE

**Problem:** Docker container can't find `/documentation/` or `/sysimages/`

**Cause:** Files copied to Windows, not in Docker

**Fix:**

```powershell
# Verify files exist on Windows
Get-ChildItem "C:\AfricaConvention\documentation\"
Get-ChildItem "C:\AfricaConvention\sysimages\"

# If missing, copy them NOW:
Copy-Item "africa-convention-training.html" -Destination "documentation/training.html" -Force
$images = @("bronchour.jpeg","Bronchour_footer.jpeg",...) # all 11
foreach ($img in $images) { Copy-Item $img -Destination "sysimages/$img" -Force }

# Restart Docker (important!)
docker-compose stop qr-api
docker-compose up -d --build
Start-Sleep -Seconds 20
```

### Issue 2: Directories Show TRUE but Files List is Empty

**Problem:** Folders exist but no files in them

**Cause:** Files not copied to correct location

**Fix:**

```powershell
# Check file locations carefully
# These must be at:
# C:\AfricaConvention\documentation\training.html
# C:\AfricaConvention\sysimages\bronchour.jpeg
# etc.

# Check current working directory
Get-Location

# Make sure you're in C:\AfricaConvention
cd C:\AfricaConvention

# List all files in all directories
Write-Host "Documentation folder:"
Get-ChildItem "documentation/"

Write-Host "sysimages folder:"
Get-ChildItem "sysimages/"

# Copy files if missing
if (-not (Test-Path "documentation/training.html")) {
  Copy-Item "africa-convention-training.html" -Destination "documentation/training.html"
}
```

### Issue 3: Files List Shows But Images Still Don't Display

**Problem:** Server sees files, but browser can't access them

**Cause:** Possible path issue in Docker or browser caching

**Fix:**

```powershell
# Hard refresh browser: Ctrl+Shift+Delete
# Clear all browser data

# Check if file serving works:
# Open: http://localhost:3000/api/debug/test-image/bronchour.jpeg

# If it downloads/shows the image, file serving works
# If it gives error, path issue in Docker
```

### Issue 4: Training Shows Error Message in Academy Tab

**Problem:** Error message instead of training content

**Solutions:**

**A) File Not Found:**
```powershell
Test-Path "documentation/training.html"
# If FALSE, copy it:
Copy-Item "africa-convention-training.html" -Destination "documentation/training.html" -Force
```

**B) File Exists but Won't Load:**
```powershell
# Check file size
(Get-Item "documentation/training.html").Length

# Should be several KB (not empty)

# If corrupted, re-download from /outputs/
```

**C) Docker Container Can't Access File:**
```powershell
# Restart with volume mount verification
docker-compose logs qr-api | grep -i "training\|error"

# Full restart
docker-compose down
docker-compose up -d --build
Start-Sleep -Seconds 20
```

---

## 📋 COMPLETE DIAGNOSTIC CHECKLIST

Run through this systematically:

```
STEP 1: File Existence (Windows)
□ C:\AfricaConvention\documentation\training.html exists
□ C:\AfricaConvention\sysimages\bronchour.jpeg exists
□ All 11 images are in sysimages\
□ No spaces or special characters in filenames

STEP 2: Docker Status
□ docker-compose ps shows both containers "Up"
□ docker-compose logs qr-api shows no errors
□ Diagnostic mode messages visible in logs

STEP 3: Directory Check in Debug Tab
□ documentation/ shows TRUE
□ sysimages/ shows TRUE
□ training.html appears in files list
□ All 11 JPEGs appear in files list

STEP 4: Image Test
□ http://localhost:3000/api/debug/test-image/bronchour.jpeg works
□ Returns image file (or error with path info)

STEP 5: Training Test
□ Click 🎓 Academy tab
□ No error message (or specific file path error)
□ Content visible

STEP 6: Gallery Test
□ Click 🖼️ Gallery tab
□ All 7 venue images show
□ Both brochures show
□ No placeholder/broken images
```

---

## 🔄 NUCLEAR OPTION: Complete Reset

If nothing works, do a complete reset:

```powershell
cd C:\AfricaConvention

# STOP everything
docker-compose down -v
Remove-Item qr-server-api.js -Force

# DELETE and RECREATE folders
Remove-Item documentation -Recurse -Force
Remove-Item sysimages -Recurse -Force
New-Item -ItemType Directory -Path "documentation" -Force | Out-Null
New-Item -ItemType Directory -Path "sysimages" -Force | Out-Null

# VERIFY files are in CURRENT directory
Get-ChildItem "*.jpeg"
Get-ChildItem "*training.html"

# If not found here, GET FILES FROM DOWNLOADS or outputs folder first!

# COPY files to correct locations
Copy-Item "africa-convention-training.html" -Destination "documentation/training.html" -Force
Copy-Item "bronchour.jpeg" -Destination "sysimages/bronchour.jpeg" -Force
# ... repeat for all 11 images

# VERIFY copies worked
Get-ChildItem "documentation/"
Get-ChildItem "sysimages/" | Measure-Object

# DEPLOY diagnostic version
Copy-Item "complete-system-diagnostic.js" -Destination "qr-server-api.js" -Force

# START fresh
docker-compose up -d --build
Start-Sleep -Seconds 20
docker-compose logs qr-api
```

---

## 🎯 HOW TO VERIFY FILES ARE ACTUALLY THERE

### Method 1: Windows Explorer
```
1. Open File Explorer
2. Navigate to C:\AfricaConvention\documentation\
3. Verify training.html is there (not a shortcut)
4. Navigate to C:\AfricaConvention\sysimages\
5. Count JPEG files (should be 11)
```

### Method 2: PowerShell

```powershell
# Detailed file listing
Write-Host "DOCUMENTATION:" -ForegroundColor Green
Get-ChildItem "documentation/" -Force | Select-Object FullName, Length

Write-Host "SYSIMAGES:" -ForegroundColor Green
Get-ChildItem "sysimages/" -Force -Recurse | Select-Object FullName, Length

Write-Host "IMAGE COUNT:" -ForegroundColor Green
(Get-ChildItem "sysimages/*.jpeg" | Measure-Object).Count
# Should show: 11
```

### Method 3: Inside Docker

```powershell
# List files inside container
docker exec qr-checkin-api ls -la /app/documentation/
docker exec qr-checkin-api ls -la /app/sysimages/
docker exec qr-checkin-api ls -la /app/sysimages/sponsors/
```

If files don't appear in Docker, they're not being mounted properly.

---

## 🚨 IF ALL ELSE FAILS

Contact with this information:

1. **Output of diagnostic tab** (screenshot or copy of debug info)
2. **Output of:** `docker-compose logs qr-api` (last 100 lines)
3. **Output of:**
   ```powershell
   Write-Host "Current directory: $(Get-Location)"
   Get-ChildItem "documentation/"
   Get-ChildItem "sysimages/"
   docker-compose ps
   ```

---

## ✅ EXPECTED FINAL STATE

After everything is fixed:

```
DOCKER LOGS:
✓ 🔍 AFRICA CONVENTION 2026 - DIAGNOSTIC MODE
✓ documentation/ exists: True
✓ sysimages/ exists: True
✓ 📄 FILES IN documentation/ (1 files):
    ✓ training.html
✓ 🖼️  FILES IN sysimages/ (11 files):
    ✓ bronchour.jpeg
    ✓ Bronchour_footer.jpeg
    ✓ ... (all 11)

BROWSER:
✓ Login page loads
✓ Header banner displays (bronchour.jpeg)
✓ Gallery tab shows all 7 images
✓ Gallery brochures visible
✓ Academy tab shows training content
✓ Debug tab shows all files listed

✅ SYSTEM FULLY OPERATIONAL
```

---

## 📞 NEXT STEPS

1. **Deploy diagnostic version** (follows instructions above)
2. **Check debug tab** - see exactly what's found/missing
3. **Apply relevant fix** from Issues section
4. **Test each component**
5. **When working, switch back to production version**

---

**The diagnostic version will tell you EXACTLY what's wrong. Use it!**
