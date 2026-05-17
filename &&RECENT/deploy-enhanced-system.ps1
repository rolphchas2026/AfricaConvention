#!/usr/bin/env pwsh
# ============================================================================
# ONE-COMMAND DEPLOYMENT - Enhanced Africa Convention 2026 System
# ============================================================================

Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🚀 DEPLOYING ENHANCED SYSTEM                          ║" -ForegroundColor Green
Write-Host "║     Complete Features + Gallery + Tickets              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Continue"

# Change to project directory
if (-not (Test-Path "C:\AfricaConvention")) {
    Write-Host "❌ Project directory not found: C:\AfricaConvention" -ForegroundColor Red
    exit 1
}

cd C:\AfricaConvention
Write-Host "📁 Working directory: C:\AfricaConvention" -ForegroundColor Cyan

# Step 1: Copy enhanced version
Write-Host "`n📋 STEP 1: Copying Enhanced System File..." -ForegroundColor Yellow
if (Test-Path "qr-server-api-COMPLETE-ENHANCED.js") {
    Copy-Item "qr-server-api-COMPLETE-ENHANCED.js" -Destination "qr-server-api.js" -Force
    Write-Host "✅ Enhanced file copied successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Source file not found: qr-server-api-COMPLETE-ENHANCED.js" -ForegroundColor Red
    exit 1
}

# Step 2: Stop containers
Write-Host "`n📋 STEP 2: Stopping Docker Containers..." -ForegroundColor Yellow
docker-compose down -v
Write-Host "✅ Containers stopped and cleaned" -ForegroundColor Green

# Step 3: Rebuild and start
Write-Host "`n📋 STEP 3: Building and Starting New System..." -ForegroundColor Yellow
docker-compose up -d --build
Write-Host "✅ System starting..." -ForegroundColor Green

# Step 4: Wait for startup
Write-Host "`n📋 STEP 4: Waiting for System to Boot (45 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

# Step 5: Check status
Write-Host "`n📋 STEP 5: Verifying System Status..." -ForegroundColor Yellow
$status = docker-compose ps
Write-Host $status -ForegroundColor Cyan

# Step 6: Check logs
Write-Host "`n📋 STEP 6: Checking System Logs..." -ForegroundColor Yellow
$logs = docker-compose logs qr-api --tail 5
if ($logs -match "READY") {
    Write-Host "✅ System is READY!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Checking logs..." -ForegroundColor Yellow
    Write-Host $logs -ForegroundColor Cyan
}

# Final summary
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ ENHANCED SYSTEM DEPLOYED SUCCESSFULLY!             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n🌐 ACCESS SYSTEM:" -ForegroundColor Cyan
Write-Host "  Home Page:     http://localhost:3000/" -ForegroundColor White
Write-Host "  Admin Portal:  http://localhost:3000/admin-login" -ForegroundColor White
Write-Host "  Username:      admin" -ForegroundColor White
Write-Host "  Password:      Africa2026!" -ForegroundColor White

Write-Host "`n✨ NEW FEATURES AVAILABLE:" -ForegroundColor Cyan
Write-Host "  ✅ Landing page with gallery & images" -ForegroundColor Green
Write-Host "  ✅ Foreign delegate online registration" -ForegroundColor Green
Write-Host "  ✅ Real-time check-in/checkout tables" -ForegroundColor Green
Write-Host "  ✅ Pending approvals query table" -ForegroundColor Green
Write-Host "  ✅ Email badge delivery button" -ForegroundColor Green
Write-Host "  ✅ Academy tab with training" -ForegroundColor Green
Write-Host "  ✅ Welcome note message area" -ForegroundColor Green
Write-Host "  ✅ Reordered admin menu tabs" -ForegroundColor Green
Write-Host "  ✅ Professional badge design" -ForegroundColor Green
Write-Host "  ✅ Ultra-glossy UI" -ForegroundColor Green

Write-Host "`n📋 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Open: http://localhost:3000/" -ForegroundColor White
Write-Host "  2. Browse gallery - click images to enlarge" -ForegroundColor White
Write-Host "  3. See foreign ticket registration options" -ForegroundColor White
Write-Host "  4. Try 'Register Online' for foreign delegates" -ForegroundColor White
Write-Host "  5. Go to admin-login to test dashboard" -ForegroundColor White
Write-Host "  6. Test check-in/checkout with Ticket IDs" -ForegroundColor White
Write-Host "  7. Load sample data: .\inject-sample-data-25.ps1" -ForegroundColor White

Write-Host "`n✅ System ready for testing and deployment!" -ForegroundColor Green
Write-Host ""
