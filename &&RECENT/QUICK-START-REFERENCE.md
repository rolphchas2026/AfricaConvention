# 🚀 QUICK START - ALL COMMANDS

## **ONE-LINE DEPLOYMENT** 

```powershell
cd C:\AfricaConvention && .\deploy-enhanced-system.ps1
```

---

## **MANUAL STEP-BY-STEP**

```powershell
# 1. Navigate to project
cd C:\AfricaConvention

# 2. Copy enhanced file
Copy-Item "qr-server-api-COMPLETE-ENHANCED.js" -Destination "qr-server-api.js" -Force

# 3. Stop & clean up
docker-compose down -v

# 4. Build & start
docker-compose up -d --build

# 5. Wait for boot
Start-Sleep -Seconds 45

# 6. Check status
docker-compose ps

# 7. Check logs
docker-compose logs qr-api --tail 20
```

---

## **LOAD SAMPLE DATA**

```powershell
cd C:\AfricaConvention
.\inject-sample-data-25.ps1
```

This loads 25 test attendees:
- 23 APPROVED (ready for check-in)
- 2 PENDING (for approval testing)
- 17 already checked-in
- 8 not checked-in

---

## **QUICK LINKS**

| Purpose | URL |
|---------|-----|
| 🏠 **Landing Page** | http://localhost:3000/ |
| 🔐 **Admin Login** | http://localhost:3000/admin-login |
| 💻 **System Health** | http://localhost:3000/api/health |

---

## **LOGIN CREDENTIALS**

```
Username: admin
Password: Africa2026!
```

---

## **TROUBLESHOOTING**

### **System won't start**
```powershell
docker-compose ps
docker-compose logs qr-api --tail 50
```

### **Database not connecting**
```powershell
docker-compose restart shared-db
Start-Sleep -Seconds 10
docker-compose restart qr-api
```

### **Full system reset**
```powershell
docker-compose down -v
Copy-Item "qr-server-api-COMPLETE-ENHANCED.js" -Destination "qr-server-api.js" -Force
docker-compose up -d --build
Start-Sleep -Seconds 45
docker-compose ps
```

---

## **WHAT'S NEW IN ENHANCED VERSION**

✅ **Landing Page**
- Event gallery (6 images)
- Clickable images with modal
- Close button (×)
- Important links (phone, email, website)

✅ **Ticket Registration**
- Foreign delegates online
- Domestic delegates at-door
- Popup registration form
- Auto Ticket ID generation

✅ **Real-Time Tables**
- Check-in shows Ticket ID
- Check-out shows duration
- Auto-calculated hours
- Instant updates

✅ **Approvals**
- Pending query table
- Email badge button
- Professional PDF badges
- Send confirmation

✅ **Admin Menu** (Reordered)
1. Academy
2. Overview
3. Ticket Cards
4. Pending
5. Approval
6. Welcome Note
7. Guest Admission
8. Check-in
9. Statistics
10. Check-out

✅ **Academy Tab**
- Training iframe
- Full integration

✅ **Welcome Message**
- Editable text area
- Broadcast ready

---

## **TEST WORKFLOW (5 MINUTES)**

```
1. Open: http://localhost:3000/
   ↓
2. Click gallery image → modal opens
   ↓
3. Click close button → modal closes
   ↓
4. Click "Register Online" → form appears
   ↓
5. Fill form → Submit
   ↓
6. See Ticket ID → Success!
   ↓
7. Go to: http://localhost:3000/admin-login
   ↓
8. Login: admin / Africa2026!
   ↓
9. Open Check-in tab
   ↓
10. Enter Ticket ID → Press ENTER
    ↓
11. See Ticket ID in table → Success! ✅
```

---

## **SAMPLE TICKET IDS** (After loading data)

```
✅ TKT-1716000001-ABC001  (John Mwangi - already checked in)
❌ TKT-1716000006-ABC006  (James Kipchoge - not checked in yet)
⏳ TKT-1716000012-ABC012  (Moses Kiplagat - PENDING approval)
```

---

## **KEY FEATURES CHECKLIST**

- [ ] Landing page loads
- [ ] Gallery images visible
- [ ] Click image → modal opens
- [ ] Close button works
- [ ] Registration popup works
- [ ] Admin login works
- [ ] All 10 tabs visible
- [ ] Check-in shows Ticket ID
- [ ] Check-out shows duration
- [ ] Pending table working
- [ ] Email badge button works
- [ ] Sample data loads
- [ ] Real-time updates work

---

## **FILES PROVIDED**

```
📦 Your Enhanced System Includes:

1. qr-server-api-COMPLETE-ENHANCED.js
   └─ Main system file with all features

2. deploy-enhanced-system.ps1
   └─ One-command deployment script

3. inject-sample-data-25.ps1
   └─ Load 25 test attendees

4. ENHANCEMENTS-COMPLETE-GUIDE.md
   └─ Detailed feature documentation

5. ALL-FIXTURES-COMPLETE-SUMMARY.md
   └─ All fixes and improvements

6. This file (Quick Start)
   └─ Fast reference guide
```

---

## **ADMIN MENU ORDER**

**Display Order (Top to Bottom):**
```
1.  📚 Academy
2.  📈 Overview
3.  🎫 Ticket Cards
4.  ⏳ Pending
5.  ✅ Approval
6.  👋 Welcome Note
7.  👤 Guest Admission
8.  ✅ Check-in
9.  📊 Statistics
10. 🚪 Check-out
```

---

## **TABS CONTENT AT A GLANCE**

| Tab | What It Does |
|-----|--------------|
| 📚 Academy | Training materials & learning |
| 📈 Overview | Real-time stats & activity |
| 🎫 Tickets | Display ticket options |
| ⏳ Pending | Pending registrations list |
| ✅ Approval | Approve + send badge email |
| 👋 Welcome | Edit welcome message |
| 👤 Admission | Register guest at door |
| ✅ Check-in | Scan QR / Ticket ID → Table |
| 📊 Stats | Category breakdown + list |
| 🚪 Check-out | Scan QR / Ticket ID → Duration |

---

## **EXPECTED BEHAVIOR**

### **Check-in**
```
Input:  TKT-1716000006-ABC006
Action: Press ENTER
Output: "Checked in: James Kipchoge" ✅
Table:  Shows Ticket ID, Name, Time, Type, Status
```

### **Check-out**
```
Input:  TKT-1716000001-ABC001
Action: Press ENTER
Output: "Checked out: John Mwangi" ✅
Table:  Shows Ticket ID, Name, Time, Duration, Status
Duration: "3 hours" (auto-calculated)
```

### **Email Badge**
```
Action: Click "Send Badge" button
Dialog: "Send badge to [email]?"
Result: "Badge sent to [email]" ✅
DB: badge_sent = true
```

---

## **PRODUCTION READY** ✅

This system is ready for:
- ✅ Real event deployment
- ✅ 400+ attendees
- ✅ Multi-staff operation
- ✅ Real-time tracking
- ✅ Professional reporting

---

## **SUPPORT CONTACTS**

📞 +255 787 576 900
📧 wccm.tz@gmail.com
🌐 www.livinghope.or.tz

---

## **QUICK TIPS**

💡 **Gallery Images Won't Show?**
- Ensure /sysimages/ folder has images
- File names must match exactly
- Check docker-compose volumes

💡 **Forms Not Submitting?**
- Hard refresh: Ctrl+F5
- Clear cache: Ctrl+Shift+Delete
- Check browser console (F12)

💡 **Check-in/Checkout Slow?**
- System may need 2-3 seconds
- Not an error, just processing
- Wait for message to appear

💡 **Table Not Updating?**
- Auto-refresh happens every 10 seconds
- Or click different tab and back
- Hard refresh if stuck

---

**Ready to deploy? Go!** 🚀

```powershell
cd C:\AfricaConvention
.\deploy-enhanced-system.ps1
```

**June 18-22, 2026 | Arusha, Tanzania**
**"Doing Business and Bearing Fruitful"** 🎉
