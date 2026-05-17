# 🎫 ID BADGE SYSTEM - COMPLETE GUIDE

## **WHAT YOU CAN DO:**

✅ **Generate professional ID badges** with:
  - Attendee name & title/category
  - Embedded QR code (scannable at entrance)
  - Event details (name, date, venue)
  - Contact information

✅ **Multiple download formats:**
  - **PDF** - Email to attendees before event
  - **Printable HTML** - Print on physical cards at arrival

✅ **Integrated into supervisor dashboard** - Generate from one place

✅ **Bulk operations** - Generate for 1 or 500 attendees at once

✅ **Different templates:**
  - Standard (Full info + QR)
  - Minimal (Name + Title + QR)

---

## 🎯 HOW IT WORKS

### **Pre-Event (2-3 days before)**
1. Open Supervisor Dashboard: http://localhost:4000
2. Click: **ID Badge Generator** tab
3. Select format: **PDF Download**
4. Click: **Select All** attendees
5. Click: **Generate Badges (PDF)**
6. Download and email PDF to all attendees
7. Attendees print or screenshot QR code on phone

### **At Event (Day of)**
1. Attendees arrive with QR code (printed or on phone)
2. Staff at entrance scans with QR system: http://localhost:3000
3. System verifies against ALFIO database ✓
4. Attendee enters

### **Alternative: Print Cards at Arrival**
1. Open Supervisor Dashboard: http://localhost:4000
2. Click: **ID Badge Generator** tab
3. Select format: **Print Ready**
4. Select attendees
5. Click: **Generate Badges (HTML)**
6. Print on ID card stock (optional cardstock)
7. Laminate for durability
8. Hand out at registration desk

---

## 📋 FILE SETUP

### **New files to download:**
```
badge-generator.jsx                    (React component)
badge-generation-api.js                (Node.js backend routes)
supervisor-dashboard-with-badges.jsx   (Updated dashboard)
package-with-badges.json               (Updated dependencies)
```

### **Replacement steps:**

**Step 1: Update package.json**
```powershell
cd C:\AfricaConvention

# Add new dependencies
npm install qrcode pdfkit
```

**Step 2: Add badge routes to API**
Copy the contents of `badge-generation-api.js` and add to your `qr-server-api.js` file (after the existing routes)

**Step 3: Update Supervisor Dashboard**
Replace old `supervisor-dashboard.jsx` with `supervisor-dashboard-with-badges.jsx`

**Step 4: Add Badge Generator Component**
Save `badge-generator.jsx` in same folder as dashboard

---

## 🖼️ BADGE DESIGN

### **Physical Layout (ID Card size: 3.5" x 2.2")**

```
┌─────────────────────────────────────────┐
│  2026 AFRICA CONVENTION                 │
│  18-22 June 2026 • Arusha, Tanzania    │
├────────────────────────────────────────┤
│                                        │
│  [QR Code]    Name: John Doe          │
│  (2x2")       Category: Speaker        │
│               Email: john@email.com    │
│               Phone: +255787576900     │
│                                        │
│               VALID EVENT ENTRY        │
│               Scan at entrance         │
│                                        │
└────────────────────────────────────────┘
```

### **Two templates:**

**Standard:**
- Full QR code
- All attendee details
- Professional layout

**Minimal:**
- Prominent QR code
- Name and category only
- Cleaner design

---

## 🚀 STEP-BY-STEP OPERATION

### **Generate PDF for Email Distribution**

**Day 1: Generate badges to email**

1. **Open Dashboard**
   ```
   http://localhost:4000
   ```

2. **Click: ID Badge Generator**
   - Tab appears in top navigation

3. **Select PDF Download**
   - Choose: "PDF Download - Email to attendees"

4. **Choose Template**
   - Standard (recommended)
   - Minimal (more compact)

5. **Filter Attendees (optional)**
   - All Categories (default)
   - Or select: Speakers, Youth, Business, etc.

6. **Select Attendees**
   - Click "Select All" (or pick individual attendees)
   - Shows count: e.g., "Selected: 450/500"

7. **Preview Badge**
   - Bottom of page shows sample badge
   - Verify it looks good

8. **Generate & Download**
   - Click: "Generate 450 Badges (PDF)"
   - Browser downloads: `badges-2026-05-18.pdf`

9. **Email to Attendees**
   - Send PDF as attachment
   - Include instructions:
     ```
     Hi [Name],
     
     Attached is your event badge for the 2026 Africa Convention.
     
     Please bring this badge (printed or on your phone) to:
     - Check in at the main entrance
     - Identify yourself throughout the event
     
     Event Details:
     Date: 18-22 June 2026
     Venue: Living Hope Mission Center, Arusha
     
     See you there!
     ```

### **Generate Printable HTML for Card Printing**

**Day of Event: Print physical badges**

1. **Open Dashboard**
   ```
   http://localhost:4000
   ```

2. **Click: ID Badge Generator**

3. **Select Print Ready**
   - Choose: "Print Ready - Physical cards"

4. **Choose Template**
   - Standard (full info)
   - Minimal (compact)

5. **Select Attendees**
   - Click "Select All" or pick batch
   - Can do multiple batches if needed

6. **Generate & Download**
   - Click: "Generate 100 Badges (HTML)"
   - Browser downloads: `badges-2026-05-18.html`

7. **Print Setup**
   - Open HTML file in browser
   - Print settings:
     - Paper: A4 or Letter
     - Orientation: Landscape
     - Margins: Minimal (if printer allows)
     - Scale: 100% (do not scale)

8. **Cut & Prep**
   - Print on card stock (optional)
   - Cut along badge boundaries
   - Laminate for durability (optional)
   - Attach lanyard or clip (optional)

9. **Hand Out**
   - At registration desk
   - One badge per attendee
   - Attendee puts on/carries to entrance

---

## 💻 TECHNICAL DETAILS

### **API Endpoints**

**Generate Badges**
```
POST /api/badges/generate
Body: {
  attendees: [{id, name, email, phone, category, ...}],
  format: "pdf" or "printable",
  template: "standard" or "minimal",
  event_name: "2026 Africa Convention",
  event_date: "18-22 June 2026",
  event_venue: "Arusha, Tanzania"
}
Response: PDF file or HTML file (download)
```

**Download All Badges**
```
GET /api/badges/download-all
Response: HTML file with all attendees
```

**Badge Statistics**
```
GET /api/badges/statistics
Response: {
  total_attendees: 500,
  badges_generated: 450,
  badges_printed: 350
}
```

**Mark Badge as Generated**
```
PUT /api/badges/:id/mark-generated
Body: { format: "pdf" or "printable" }
Response: Updated attendee record
```

### **QR Code Details**

Each badge contains:
- **Data:** Attendee ID (e.g., `123`)
- **Error Correction:** High (H)
- **Size:** 200x200 pixels (scales with badge)
- **Format:** PNG embedded in PDF/HTML

When scanned at entrance:
- QR decoder reads the ID
- System looks up attendee in database
- Verifies against ALFIO registration
- Records check-in with timestamp

---

## 🎨 CUSTOMIZATION

### **Modify Badge Design**

**Edit colors:**
In `badge-generator.jsx`:
```jsx
// Change from blue to green
from-blue-600 → from-green-600
to-blue-700 → to-green-700
```

**Change event details:**
In supervisor dashboard component:
```jsx
event_name: '2026 Africa Convention'
event_date: '18-22 June 2026'
event_venue: 'Arusha, Tanzania'
```

**Add logo:**
In PDF generation (badge-generation-api.js):
```javascript
doc.image('./logo.png', 50, 55, { width: 100 });
```

---

## 📊 WORKFLOW EXAMPLES

### **Scenario 1: Email Badges Before Event**

```
Monday (5 days before):
  └─ Generate PDF badges for all 500 attendees
  └─ Email to all registered participants
  └─ Attendees print or screenshot QR codes

Friday (event day):
  └─ No printing needed
  └─ Attendees arrive with QR code on phone/paper
  └─ Scan at entrance = instant check-in
  └─ No ID cards printed
```

### **Scenario 2: Print Cards at Arrival**

```
Thursday (1 day before):
  └─ Generate HTML badges for all 500 attendees
  └─ Print on cardstock
  └─ Cut and laminate
  └─ Bundle by category

Friday (event day):
  └─ Registration desk has printed badges
  └─ Attendee arrives → gets badge → goes to entrance
  └─ Staff scans QR code on badge
  └─ Instant check-in + photo with badge
  └─ Professional photos with ID visible
```

### **Scenario 3: Mixed Approach**

```
Monday (pre-event):
  └─ Generate PDF, email to all attendees
  └─ Attendees bring QR on phone

Thursday (day before):
  └─ Print badges for speakers/VIPs only
  └─ Professional photo ops
  └─ Rest use digital QR codes

Friday (event day):
  └─ Speakers/VIPs have printed badges
  └─ General attendees use digital QR
  └─ All scan same way = single entry process
```

---

## ✅ QUALITY CHECKLIST

**Before generating badges:**
- [ ] All attendees registered in ALFIO
- [ ] Names are correct (check for spelling)
- [ ] Email addresses valid
- [ ] Categories assigned correctly
- [ ] Event details accurate

**Before printing:**
- [ ] Preview badge looks good
- [ ] QR code is clear and scans
- [ ] Text is readable
- [ ] Logo/colors correct
- [ ] All attendee info included

**Before distribution:**
- [ ] PDFs sent to all email addresses
- [ ] Printed cards checked for quality
- [ ] QR codes tested (scan a few)
- [ ] Cards are durable/laminated
- [ ] Instructions clear to attendees

---

## 🔍 TROUBLESHOOTING

### **"Badge generation failed" error**
**Solution:**
- Check if API is running: `http://localhost:3000/api/health`
- Check logs: `docker-compose logs qr-api`
- Verify attendees have all required fields

### **QR Code doesn't scan**
**Solution:**
- Make sure QR code image is clear
- Check error correction level (should be High)
- Test with different phone cameras
- Ensure code isn't distorted in printing

### **PDF is corrupted**
**Solution:**
- Check server logs for errors
- Try generating smaller batch (10 attendees)
- Verify Node.js dependencies installed: `npm install qrcode pdfkit`

### **Print layout is wrong**
**Solution:**
- Use 100% scale (no scaling)
- Use landscape orientation
- Set minimal margins (0 if possible)
- Try different browser (Chrome best for printing)

---

## 📱 ATTENDEE INSTRUCTIONS

**Email template to send with PDF:**

```
Subject: Your Event Badge - 2026 Africa Convention

Hi [Name],

Attached is your official event badge for:

🎉 2026 AFRICA CONVENTION
Theme: "Doing Business and Bearing Fruitful"
Date: 18-22 June 2026
Venue: Living Hope Mission Center, Arusha, Tanzania

HOW TO USE YOUR BADGE:

1. Print the attached PDF (1 page = 2 badges)
   OR take a screenshot on your phone
   
2. Bring your badge to the event

3. At the main entrance, show your QR code to staff
   (They will scan it to check you in)

4. Once verified, you'll receive your entrance pass

5. Wear or carry your badge throughout the event

IMPORTANT:
- Your QR code is unique to you - do not share
- One badge per person
- Bring ID for verification (optional)

Questions?
Email: wccm.tz@gmail.com
WhatsApp: +255 787 576 900

See you at the convention!

Best regards,
Living Hope Mission
```

---

## 🎊 SUCCESS INDICATORS

✅ System working when:
- Badge generator appears in dashboard
- Can select attendees
- Badge preview shows correct info
- PDF downloads successfully
- QR codes are clear and scannable
- Scanned QR codes match attendee IDs
- Check-in records appear in dashboard

---

## 📞 SUPPORT

**If something doesn't work:**

1. Check API is running:
   ```powershell
   docker-compose ps
   ```

2. Check API logs:
   ```powershell
   docker-compose logs qr-api
   ```

3. Verify dependencies:
   ```powershell
   npm list qrcode pdfkit
   ```

4. Test QR generation:
   ```powershell
   curl http://localhost:3000/api/health
   ```

---

**You now have a complete ID badge system! 🎫**

Generate badges in seconds, distribute digitally or print physically, and make attendee check-in seamless and professional.

Good luck with your event! 🎉
