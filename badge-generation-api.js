// badge-generation-api.js
// Add these routes to your qr-server-api.js file

const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');

// ==================== BADGE GENERATION ROUTES ====================

// POST: Generate badges (PDF or HTML)
app.post('/api/badges/generate', async (req, res) => {
  const { attendees, format, template, event_name, event_date, event_venue } = req.body;

  if (!attendees || attendees.length === 0) {
    return res.status(400).json({ error: 'No attendees provided' });
  }

  try {
    if (format === 'pdf') {
      await generatePDFBadges(attendees, template, event_name, event_date, event_venue, res);
    } else if (format === 'printable') {
      await generatePrintableHTML(attendees, template, event_name, event_date, event_venue, res);
    } else {
      res.status(400).json({ error: 'Invalid format' });
    }
  } catch (error) {
    console.error('Badge generation error:', error);
    res.status(500).json({ error: 'Failed to generate badges' });
  }
});

// ==================== PDF GENERATION ====================

async function generatePDFBadges(attendees, template, eventName, eventDate, eventVenue, res) {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="badges.pdf"');
    doc.pipe(res);

    // Add badges to PDF
    for (let i = 0; i < attendees.length; i++) {
      if (i > 0) doc.addPage();
      
      const attendee = attendees[i];
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(attendee.id.toString(), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 200,
        margin: 1
      });

      // Draw badge background
      doc
        .rect(30, 30, 540, 340)
        .fillAndStroke('#1e40af', '#000');

      // White background for content
      doc
        .rect(40, 40, 520, 320)
        .fill('#ffffff');

      // Header
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fill('#1e40af')
        .text('2026 AFRICA CONVENTION', 50, 55, { width: 500, align: 'center' });

      doc
        .fontSize(8)
        .font('Helvetica')
        .fill('#3b82f6')
        .text('18-22 June 2026 • Arusha, Tanzania', 50, 70, { width: 500, align: 'center' });

      // QR Code
      doc.image(qrCodeDataUrl, 60, 95, { width: 100, height: 100 });

      // Attendee Info
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fill('#000')
        .text(attendee.name, 180, 100, { width: 350 });

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fill('#1e40af')
        .text(attendee.category, 180, 130);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fill('#333')
        .text(`Email: ${attendee.email}`, 180, 155);

      if (attendee.phone) {
        doc.text(`Phone: ${attendee.phone}`, 180, 170);
      }

      // Separator line
      doc
        .moveTo(50, 210)
        .lineTo(550, 210)
        .stroke('#bfdbfe');

      // Event Entry Section
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fill('#1e40af')
        .text('VALID EVENT ENTRY', 50, 225);

      doc
        .fontSize(8)
        .font('Helvetica')
        .fill('#666')
        .text('Scan QR code at main entrance | 18-22 June 2026', 50, 245, { width: 500 });

      // Footer
      doc
        .fontSize(7)
        .fill('#999')
        .text('Event ID: ' + attendee.id, 50, 315, { width: 500, align: 'center' });
    }

    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}

// ==================== PRINTABLE HTML GENERATION ====================

async function generatePrintableHTML(attendees, template, eventName, eventDate, eventVenue, res) {
  try {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Event Badges</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            background: #f0f0f0;
            padding: 20px;
          }
          
          .page {
            page-break-after: always;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            padding: 10px;
            background: white;
          }
          
          .badge-container {
            page-break-inside: avoid;
            width: calc(50% - 5px);
            aspect-ratio: 3.5 / 2.2;
          }
          
          .badge {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 4px solid #1e40af;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 14px;
          }
          
          .badge-qr {
            flex-shrink: 0;
            width: 140px;
            height: 140px;
            background: white;
            border: 2px solid #1e40af;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
          }
          
          .badge-qr img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          
          .badge-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
          }
          
          .badge-header {
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 2px solid #bfdbfe;
            margin-bottom: 8px;
          }
          
          .event-title {
            font-size: 8px;
            font-weight: bold;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .event-subtitle {
            font-size: 7px;
            color: #3b82f6;
            margin-top: 2px;
          }
          
          .attendee-name {
            font-size: 20px;
            font-weight: bold;
            color: #000;
            line-height: 1.2;
            margin-bottom: 4px;
          }
          
          .attendee-category {
            font-size: 11px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 4px;
          }
          
          .attendee-details {
            font-size: 8px;
            color: #666;
            margin-bottom: 4px;
          }
          
          .badge-footer {
            font-size: 7px;
            color: #1e40af;
            font-weight: bold;
            border-top: 1px solid #bfdbfe;
            padding-top: 4px;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .page {
              page-break-after: always;
              padding: 0;
              margin: 0;
              background: white;
            }
          }
        </style>
      </head>
      <body>
    `;

    // Generate QR codes for each attendee
    for (let i = 0; i < attendees.length; i++) {
      if (i > 0 && i % 2 === 0) {
        html += '</div><div class="page">';
      }

      const attendee = attendees[i];
      const qrCodeDataUrl = await QRCode.toDataURL(attendee.id.toString(), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 200,
        margin: 1
      });

      html += `
        <div class="badge-container">
          <div class="badge">
            <div class="badge-qr">
              <img src="${qrCodeDataUrl}" alt="QR Code">
            </div>
            <div class="badge-info">
              <div class="badge-header">
                <div class="event-title">2026 Africa Convention</div>
                <div class="event-subtitle">18-22 June 2026 • Arusha</div>
              </div>
              <div>
                <div class="attendee-name">${escapeHtml(attendee.name)}</div>
                <div class="attendee-category">${escapeHtml(attendee.category)}</div>
                <div class="attendee-details">
                  <strong>Email:</strong> ${escapeHtml(attendee.email)}<br>
                  ${attendee.phone ? `<strong>Phone:</strong> ${escapeHtml(attendee.phone)}<br>` : ''}
                </div>
              </div>
              <div class="badge-footer">
                ✓ VALID ENTRY | Scan QR at entrance
              </div>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="badges.html"');
    res.send(html);

  } catch (error) {
    console.error('HTML generation error:', error);
    throw error;
  }
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// POST: Bulk download badges for event
app.get('/api/badges/download-all', async (req, res) => {
  try {
    // Get all attendees
    const result = await pool.query(
      `SELECT * FROM attendees WHERE event_id = $1 ORDER BY registered_at DESC`,
      ['2026-africa']
    );

    const attendees = result.rows;

    if (attendees.length === 0) {
      return res.status(404).json({ error: 'No attendees found' });
    }

    // Generate as printable HTML (better for bulk printing)
    await generatePrintableHTML(
      attendees,
      'standard',
      '2026 Africa Convention',
      '18-22 June 2026',
      'Arusha, Tanzania',
      res
    );

  } catch (error) {
    console.error('Bulk download error:', error);
    res.status(500).json({ error: 'Failed to download badges' });
  }
});

// GET: Badge statistics
app.get('/api/badges/statistics', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_attendees,
        COUNT(CASE WHEN metadata->>'badge_generated' = 'true' THEN 1 END) as badges_generated,
        COUNT(CASE WHEN metadata->>'badge_printed' = 'true' THEN 1 END) as badges_printed
      FROM attendees
    `);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// PUT: Mark badge as generated
app.put('/api/badges/:id/mark-generated', async (req, res) => {
  const { id } = req.params;
  const { format } = req.body;

  try {
    const result = await pool.query(
      `UPDATE attendees 
       SET metadata = metadata || $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({ 
        [`badge_${format}_generated`]: new Date().toISOString() 
      }), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json({
      success: true,
      message: `Badge marked as ${format} generated`,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Mark generated error:', error);
    res.status(500).json({ error: 'Failed to mark badge' });
  }
});

// ==================== END OF BADGE ROUTES ====================
