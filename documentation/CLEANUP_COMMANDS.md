# 🧹 AFRICA CONVENTION 2026 - PROJECT CLEANUP COMMANDS

## OPTION 1: QUICK ANALYSIS (Safe - No Deletions)

Run this to see what can be cleaned up:

```powershell
cd C:\AfricaConvention

# Show all files and folders
Write-Host "PROJECT STRUCTURE:" -ForegroundColor Green
Get-ChildItem -Path . -Recurse | Select-Object FullName, @{Name="Size";Expression={if($_.PSIsContainer){"<DIR>"}else{"{0:N0}" -f $_.Length}}} | Format-Table -AutoSize

# Count files
Write-Host "`nFILE SUMMARY:" -ForegroundColor Green
$files = Get-ChildItem -Path . -Recurse -File
$dirs = Get-ChildItem -Path . -Recurse -Directory
Write-Host "Total Files: $($files.Count)"
Write-Host "Total Directories: $($dirs.Count)"
Write-Host "Total Size: $('{0:N2}' -f (($files | Measure-Object -Property Length -Sum).Sum / 1MB)) MB"

# Show all .md files (can usually be deleted)
Write-Host "`nMARKDOWN FILES (.md) - Can be deleted:" -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "*.md" | ForEach-Object {
    Write-Host "  • $($_.FullName.Replace($PWD, '.'))"
}

# Show diagnostic/test files
Write-Host "`nDIAGNOSTIC/TEST FILES - Can be deleted:" -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -File | Where-Object { $_.Name -match "diagnostic|test|backup|old|\.bak|\.tmp" } | ForEach-Object {
    Write-Host "  • $($_.FullName.Replace($PWD, '.'))"
}

# Show node_modules (if present)
if (Test-Path "node_modules") {
    $nodeSize = (Get-ChildItem -Path "node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum
    Write-Host "`nNODE_MODULES - Can be deleted (can be reinstalled with npm install):" -ForegroundColor Yellow
    Write-Host "  • node_modules/ - $('{0:N2}' -f ($nodeSize / 1MB)) MB"
}

# Show empty directories
Write-Host "`nEMPTY DIRECTORIES - Can be deleted:" -ForegroundColor Yellow
$emptyDirs = Get-ChildItem -Path . -Recurse -Directory | Where-Object { @(Get-ChildItem -Path $_.FullName).Count -eq 0 }
if ($emptyDirs.Count -eq 0) {
    Write-Host "  (none)"
} else {
    $emptyDirs | ForEach-Object {
        Write-Host "  • $($_.FullName.Replace($PWD, '.'))"
    }
}

# Show what should be KEPT
Write-Host "`nIMPORTANT FILES TO KEEP:" -ForegroundColor Green
$keepFiles = @(
    "qr-server-api.js",
    "docker-compose.yml",
    "Dockerfile.qr",
    "package.json",
    "package-lock.json"
)
$keepFiles | ForEach-Object {
    $exists = Test-Path $_
    Write-Host "  $(if($exists){'✓'}else{'✗'}) $_"
}

Write-Host "`nIMPORTANT DIRECTORIES TO KEEP:" -ForegroundColor Green
$keepDirs = @("documentation", "sysimages")
$keepDirs | ForEach-Object {
    $exists = Test-Path $_
    Write-Host "  $(if($exists){'✓'}else{'✗'}) $_/"
}
```

---

## OPTION 2: DELETE UNNECESSARY FILES

Run this to clean up (with confirmation):

```powershell
cd C:\AfricaConvention

# Delete all markdown files (EXCEPT THOSE YOU WANT TO KEEP)
Write-Host "Deleting markdown files (.md)..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "*.md" | ForEach-Object {
    Write-Host "Deleting: $($_.Name)"
    Remove-Item -Path $_.FullName -Force
}

# Delete diagnostic/test files
Write-Host "`nDeleting diagnostic/test files..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -File | Where-Object { 
    $_.Name -match "diagnostic|test|backup|old" -and $_.Name -notmatch "qr-server-api"
} | ForEach-Object {
    Write-Host "Deleting: $($_.Name)"
    Remove-Item -Path $_.FullName -Force
}

# Delete temp/cache files
Write-Host "`nDeleting temp/cache files..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -File | Where-Object {
    $_.Extension -in @(".bak", ".tmp", ".log", ".swp", ".swo") -or
    $_.Name -in @("Thumbs.db", ".DS_Store")
} | ForEach-Object {
    Write-Host "Deleting: $($_.Name)"
    Remove-Item -Path $_.FullName -Force
}

# Delete .vscode, .idea, node_modules (optional - uncomment to use)
# Write-Host "`nDeleting IDE/cache folders..." -ForegroundColor Yellow
# @(".vscode", ".idea", "node_modules") | ForEach-Object {
#     if (Test-Path $_) {
#         Write-Host "Deleting: $_/"
#         Remove-Item -Path $_ -Recurse -Force
#     }
# }

# Delete empty directories
Write-Host "`nDeleting empty directories..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Directory | Where-Object { 
    @(Get-ChildItem -Path $_.FullName).Count -eq 0 -and $_.Name -notmatch "sponsors"
} | ForEach-Object {
    Write-Host "Deleting: $($_.FullName.Replace($PWD, '.'))"
    Remove-Item -Path $_.FullName -Force
}

Write-Host "`n✓ Cleanup complete!" -ForegroundColor Green
```

---

## OPTION 3: SELECTIVE CLEANUP (Interactive)

```powershell
cd C:\AfricaConvention

Write-Host "SELECTIVE CLEANUP - Choose what to delete" -ForegroundColor Cyan

# Ask about markdown files
$mdFiles = Get-ChildItem -Path . -Recurse -Filter "*.md"
if ($mdFiles.Count -gt 0) {
    Write-Host "`n📄 Found $($mdFiles.Count) markdown files (.md)"
    $mdFiles | ForEach-Object { Write-Host "  • $($_.Name)" }
    $response = Read-Host "Delete all markdown files? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        $mdFiles | Remove-Item -Force
        Write-Host "✓ Deleted markdown files" -ForegroundColor Green
    }
}

# Ask about diagnostic files
$diagFiles = Get-ChildItem -Path . -Recurse -File | Where-Object { 
    $_.Name -match "diagnostic|test" 
}
if ($diagFiles.Count -gt 0) {
    Write-Host "`n🔧 Found $($diagFiles.Count) diagnostic/test files"
    $diagFiles | ForEach-Object { Write-Host "  • $($_.Name)" }
    $response = Read-Host "Delete diagnostic/test files? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        $diagFiles | Remove-Item -Force
        Write-Host "✓ Deleted diagnostic files" -ForegroundColor Green
    }
}

# Ask about node_modules
if (Test-Path "node_modules") {
    $nodeSize = (Get-ChildItem -Path "node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum
    Write-Host "`n📦 Found node_modules/ - $('{0:N2}' -f ($nodeSize / 1MB)) MB"
    Write-Host "   (Can be reinstalled with: npm install)"
    $response = Read-Host "Delete node_modules? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Remove-Item -Path "node_modules" -Recurse -Force
        Write-Host "✓ Deleted node_modules" -ForegroundColor Green
    }
}

Write-Host "`n✓ Selective cleanup complete!" -ForegroundColor Green
```

---

## OPTION 4: COMPLETE ANALYSIS REPORT

Save this to a file for detailed analysis:

```powershell
cd C:\AfricaConvention

$reportFile = "cleanup_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

"AFRICA CONVENTION 2026 - PROJECT CLEANUP REPORT" | Tee-Object -FilePath $reportFile
"Generated: $(Get-Date)" | Tee-Object -FilePath $reportFile -Append
"Project: C:\AfricaConvention" | Tee-Object -FilePath $reportFile -Append
"" | Tee-Object -FilePath $reportFile -Append

# Overall statistics
Write-Host "Generating report..." -ForegroundColor Yellow
$files = Get-ChildItem -Path . -Recurse -File
$dirs = Get-ChildItem -Path . -Recurse -Directory
$totalSize = ($files | Measure-Object -Property Length -Sum).Sum

"OVERALL STATISTICS:" | Tee-Object -FilePath $reportFile -Append
"  Total Files: $($files.Count)" | Tee-Object -FilePath $reportFile -Append
"  Total Directories: $($dirs.Count)" | Tee-Object -FilePath $reportFile -Append
"  Total Size: $('{0:N2}' -f ($totalSize / 1MB)) MB" | Tee-Object -FilePath $reportFile -Append
"" | Tee-Object -FilePath $reportFile -Append

# Files to keep
"FILES TO KEEP:" | Tee-Object -FilePath $reportFile -Append
@(
    "qr-server-api.js",
    "docker-compose.yml",
    "Dockerfile.qr",
    "package.json",
    "package-lock.json"
) | ForEach-Object {
    $exists = Test-Path $_
    "  $(if($exists){'✓'}else{'✗'}) $_" | Tee-Object -FilePath $reportFile -Append
}
"" | Tee-Object -FilePath $reportFile -Append

# Directories to keep
"DIRECTORIES TO KEEP:" | Tee-Object -FilePath $reportFile -Append
@("documentation", "sysimages") | ForEach-Object {
    $exists = Test-Path $_
    "  $(if($exists){'✓'}else{'✗'}) $_/" | Tee-Object -FilePath $reportFile -Append
}
"" | Tee-Object -FilePath $reportFile -Append

# Files that can be deleted
"FILES THAT CAN BE DELETED:" | Tee-Object -FilePath $reportFile -Append
Get-ChildItem -Path . -Recurse -Filter "*.md" | ForEach-Object {
    "  ✗ Markdown: $($_.FullName.Replace($PWD, '.'))" | Tee-Object -FilePath $reportFile -Append
}
Get-ChildItem -Path . -Recurse -File | Where-Object { 
    $_.Name -match "diagnostic|test|backup" 
} | ForEach-Object {
    "  ✗ Temp: $($_.FullName.Replace($PWD, '.'))" | Tee-Object -FilePath $reportFile -Append
}
"" | Tee-Object -FilePath $reportFile -Append

# Empty directories
$emptyDirs = Get-ChildItem -Path . -Recurse -Directory | Where-Object { 
    @(Get-ChildItem -Path $_.FullName).Count -eq 0 
}
if ($emptyDirs.Count -gt 0) {
    "EMPTY DIRECTORIES:" | Tee-Object -FilePath $reportFile -Append
    $emptyDirs | ForEach-Object {
        "  ✗ $($_.FullName.Replace($PWD, '.'))" | Tee-Object -FilePath $reportFile -Append
    }
}

Write-Host "`n✓ Report saved to: $reportFile" -ForegroundColor Green
Invoke-Item $reportFile
```

---

## QUICK COMMANDS

### Check project size:
```powershell
cd C:\AfricaConvention
"{0:N2} MB" -f ((Get-ChildItem -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB)
```

### Count files:
```powershell
cd C:\AfricaConvention
(Get-ChildItem -Recurse -File).Count
```

### List large files:
```powershell
cd C:\AfricaConvention
Get-ChildItem -Recurse -File | Sort-Object -Property Length -Descending | Select-Object -First 10 Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

### Find and delete specific file type:
```powershell
cd C:\AfricaConvention
Get-ChildItem -Recurse -Filter "*.md" | Remove-Item -Force
```

### Delete all .log files:
```powershell
cd C:\AfricaConvention
Get-ChildItem -Recurse -Filter "*.log" | Remove-Item -Force
```

### Show directory tree:
```powershell
cd C:\AfricaConvention
Get-ChildItem -Recurse | Where-Object { $_.PSIsContainer } | Sort-Object -Property Name | ForEach-Object { Write-Host ("  " * ($_.FullName.Split('\').Count - 5)) + "📁 " + $_.Name }
```

---

## 🎯 RECOMMENDED CLEANUP STEPS

1. **First - Analyze:** Run OPTION 1 to see what can be cleaned
2. **Review:** Check what files/folders are safe to delete
3. **Execute:** Run OPTION 2 or OPTION 3 to delete
4. **Verify:** Confirm system still works after cleanup
5. **Report:** Check the report file for details

---

## ⚠️ IMPORTANT - NEVER DELETE

```
✗ DO NOT DELETE:
  • qr-server-api.js
  • docker-compose.yml
  • Dockerfile.qr
  • package.json
  • package-lock.json
  • documentation/ folder
  • sysimages/ folder
  • Any .jpeg image files
  • training.html
```

---

## 📊 SAFE TO DELETE

```
✓ SAFE TO DELETE:
  • *.md files (markdown documentation)
  • *diagnostic*.js files
  • *test*.js files
  • *backup* files
  • *.bak, *.tmp, *.log files
  • .vscode/ folder
  • .idea/ folder
  • node_modules/ folder (can reinstall with npm install)
  • Empty directories
  • Thumbs.db, .DS_Store
```

---

**Pick the option that works best for you! Option 1 is safest - try that first.** 🧹
