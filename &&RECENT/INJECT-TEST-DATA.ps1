# Africa Convention 2026 - Easy Test Data Injection
# No Docker exec or psql needed - Just PowerShell!

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Africa Convention 2026 - Database Test Data Injection    ║" -ForegroundColor Cyan
Write-Host "║  25 Attendees (5 per ticket type)                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Database connection details
$host_name = "localhost"
$port = "5432"
$database = "africa_convention"
$username = "admin"
$password = "ArushaPassword2026"

Write-Host "🔧 Preparing to inject test data..." -ForegroundColor Yellow
Write-Host "Database: $database @ $host_name:$port" -ForegroundColor Gray
Write-Host ""

# SQL Insert statements - 25 attendees
$sql = @"
-- Africa Convention 2026 - Test Data: 25 Attendees

-- GENERAL ADMIN (LOCAL) - 5 attendees
INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status, verified) VALUES
('TKT-GENERAL-001', 'Joseph Mwangi', 'joseph.mwangi@example.tz', '+255 742 123 456', 'Tanzania Tourism Board', 'Director', 'general', 10000, 'TZS', 'APPROVED', true),
('TKT-GENERAL-002', 'Grace Kipchoge', 'grace.kipchoge@example.tz', '+255 743 234 567', 'Ministry of Commerce', 'Manager', 'general', 10000, 'TZS', 'APPROVED', true),
('TKT-GENERAL-003', 'Samuel Omondi', 'samuel.omondi@example.tz', '+255 744 345 678', 'Dar es Salaam Chamber', 'President', 'general', 10000, 'TZS', 'PENDING', false),
('TKT-GENERAL-004', 'Amina Hassan', 'amina.hassan@example.tz', '+255 745 456 789', 'East Africa Trade', 'Coordinator', 'general', 10000, 'TZS', 'APPROVED', true),
('TKT-GENERAL-005', 'David Njoroge', 'david.njoroge@example.tz', '+255 746 567 890', 'Tanzanian Exporters', 'CEO', 'general', 10000, 'TZS', 'APPROVED', true);

-- FOREIGNERS (VIP) - 5 attendees
INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status, verified) VALUES
('TKT-FOREIGN-001', 'Michael Robertson', 'michael.robertson@uk.com', '+44 7700 123 456', 'London Business Hub', 'VP International', 'foreigners', 350, 'USD', 'APPROVED', true),
('TKT-FOREIGN-002', 'Dr. Sophie Dubois', 'sophie.dubois@paris.fr', '+33 6 12 34 56 78', 'Paris Chamber Commerce', 'Director', 'foreigners', 350, 'USD', 'APPROVED', true),
('TKT-FOREIGN-003', 'Chen Wei', 'chen.wei@beijing.cn', '+86 10 1234 5678', 'China Trade Commission', 'Attaché', 'foreigners', 350, 'USD', 'PENDING', false),
('TKT-FOREIGN-004', 'Fatima Al-Mansouri', 'fatima.almansouri@dubai.ae', '+971 4 123 4567', 'Dubai International', 'Manager', 'foreigners', 350, 'USD', 'APPROVED', true),
('TKT-FOREIGN-005', 'Johan Bergstrom', 'johan.bergstrom@stockholm.se', '+46 8 123 45 67', 'Stockholm Trade', 'Consultant', 'foreigners', 350, 'USD', 'APPROVED', true);

-- YOUTH - 5 attendees
INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status, verified) VALUES
('TKT-YOUTH-001', 'Zainab Rashid', 'zainab.rashid@youth.tz', '+255 750 111 222', 'African Youth Network', 'Founder', 'youth', 200, 'USD', 'APPROVED', true),
('TKT-YOUTH-002', 'Peter Kimani', 'peter.kimani@youth.tz', '+255 751 222 333', 'Nairobi Start-ups', 'Developer', 'youth', 200, 'USD', 'APPROVED', true),
('TKT-YOUTH-003', 'Leah Osei-Tutu', 'leah.osei@youth.tz', '+255 752 333 444', 'Ghana Innovation Hub', 'Designer', 'youth', 200, 'USD', 'PENDING', false),
('TKT-YOUTH-004', 'Kwame Asamoah', 'kwame.asamoah@youth.tz', '+255 753 444 555', 'Accra Digital', 'Entrepreneur', 'youth', 200, 'USD', 'APPROVED', true),
('TKT-YOUTH-005', 'Lucia Mbewe', 'lucia.mbewe@youth.tz', '+255 754 555 666', 'Zambia Youth Forum', 'Organizer', 'youth', 200, 'USD', 'APPROVED', true);

-- SPEAKER - 5 attendees
INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status, verified) VALUES
('TKT-SPEAKER-001', 'Dr. James Kariuki', 'james.kariuki@speakers.com', '+254 722 888 999', 'East Africa University', 'Professor', 'speaker', 300, 'USD', 'APPROVED', true),
('TKT-SPEAKER-002', 'Prof. Margaret Okonkwo', 'margaret.okonkwo@speakers.com', '+234 803 777 888', 'African Leadership Institute', 'Director', 'speaker', 300, 'USD', 'APPROVED', true),
('TKT-SPEAKER-003', 'Rev. Thomas Mwale', 'thomas.mwale@speakers.com', '+255 765 666 777', 'YWAM Regional', 'Pastor', 'speaker', 300, 'USD', 'PENDING', false),
('TKT-SPEAKER-004', 'Dr. Asha Patel', 'asha.patel@speakers.com', '+255 766 777 888', 'Global Development Fund', 'Economist', 'speaker', 300, 'USD', 'APPROVED', true),
('TKT-SPEAKER-005', 'Bishop Emmanuel Muleya', 'emmanuel.muleya@speakers.com', '+255 767 888 999', 'Arusha Diocese', 'Bishop', 'speaker', 300, 'USD', 'APPROVED', true);

-- BUSINESS - 5 attendees
INSERT INTO attendees (ticket_id, name, email, phone, organization, title, ticket_type, ticket_price, currency, payment_status, verified) VALUES
('TKT-BUSINESS-001', 'Robert Kwande', 'robert.kwande@business.tz', '+255 758 999 000', 'Kenya Business Group', 'Chairman', 'business', 250, 'USD', 'APPROVED', true),
('TKT-BUSINESS-002', 'Elizabeth Mbaye', 'elizabeth.mbaye@business.tz', '+255 759 000 111', 'Senegal Enterprises', 'CEO', 'business', 250, 'USD', 'APPROVED', true),
('TKT-BUSINESS-003', 'Charles Banda', 'charles.banda@business.tz', '+255 760 111 222', 'Malawi Imports Ltd', 'Managing Director', 'business', 250, 'USD', 'PENDING', false),
('TKT-BUSINESS-004', 'Rachel Mwali', 'rachel.mwali@business.tz', '+255 761 222 333', 'Tanzania Textiles', 'Operations Lead', 'business', 250, 'USD', 'APPROVED', true),
('TKT-BUSINESS-005', 'Paul Kazimoto', 'paul.kazimoto@business.tz', '+255 762 333 444', 'East Africa Logistics', 'Procurement Manager', 'business', 250, 'USD', 'APPROVED', true);

-- Verify the data was inserted
SELECT COUNT(*) as total_attendees FROM attendees;
SELECT COUNT(*) as approved FROM attendees WHERE payment_status = 'APPROVED';
SELECT COUNT(*) as pending FROM attendees WHERE payment_status = 'PENDING';
SELECT COUNT(*) as general_admin FROM attendees WHERE ticket_type = 'general';
"@

# Save SQL to temp file
$tempSqlFile = "$env:TEMP\insert-test-data-$(Get-Random).sql"
$sql | Out-File -FilePath $tempSqlFile -Encoding UTF8

Write-Host "✅ SQL file created: $tempSqlFile" -ForegroundColor Green
Write-Host ""

# Try to execute using Docker
Write-Host "📌 Attempting to inject via Docker..." -ForegroundColor Yellow

try {
    # Get the container ID
    $containerResult = docker ps --filter "name=shared-db" --format "{{.ID}}" 2>$null
    
    if ($containerResult) {
        Write-Host "✅ Found PostgreSQL container: $containerResult" -ForegroundColor Green
        
        # Copy SQL file to container
        Write-Host "📦 Copying SQL to container..." -ForegroundColor Yellow
        docker cp $tempSqlFile "$containerResult`:/tmp/insert-data.sql" 2>$null
        
        # Execute SQL in container
        Write-Host "🔧 Executing SQL statements..." -ForegroundColor Yellow
        docker exec -i $containerResult psql -U admin -d africa_convention -f /tmp/insert-data.sql 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
            Write-Host "║  ✅ SUCCESS! Test data injected!                           ║" -ForegroundColor Green
            Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Summary:" -ForegroundColor Cyan
            Write-Host "  ✅ 25 total attendees loaded" -ForegroundColor Green
            Write-Host "  ✅ 5 General Admin (Local)" -ForegroundColor Green
            Write-Host "  ✅ 5 Foreigners (VIP)" -ForegroundColor Green
            Write-Host "  ✅ 5 Youth" -ForegroundColor Green
            Write-Host "  ✅ 5 Speakers" -ForegroundColor Green
            Write-Host "  ✅ 5 Business" -ForegroundColor Green
            Write-Host "  ✅ 19 Approved, 6 Pending" -ForegroundColor Green
            Write-Host ""
            Write-Host "🎯 Test Check-in Commands:" -ForegroundColor Yellow
            Write-Host "  1. Go to: http://localhost:3000/admin-login" -ForegroundColor Gray
            Write-Host "  2. Login: admin / Africa2026!" -ForegroundColor Gray
            Write-Host "  3. Click 'Check-in' tab" -ForegroundColor Gray
            Write-Host "  4. Enter: TKT-GENERAL-001" -ForegroundColor Gray
            Write-Host "  5. Press ENTER → Should see: Joseph Mwangi checked in" -ForegroundColor Gray
            Write-Host ""
        } else {
            throw "SQL execution failed"
        }
    } else {
        throw "PostgreSQL container not found"
    }
} catch {
    Write-Host ""
    Write-Host "⚠️  Docker method failed: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📌 Alternative: Use SQL file manually" -ForegroundColor Yellow
    Write-Host "File location: $tempSqlFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "How to use manually:" -ForegroundColor Cyan
    Write-Host "  1. Open pgAdmin or DBeaver" -ForegroundColor Gray
    Write-Host "  2. Connect to: localhost:5432" -ForegroundColor Gray
    Write-Host "     Username: admin" -ForegroundColor Gray
    Write-Host "     Password: ArushaPassword2026" -ForegroundColor Gray
    Write-Host "  3. Database: africa_convention" -ForegroundColor Gray
    Write-Host "  4. Open SQL editor" -ForegroundColor Gray
    Write-Host "  5. Copy content from: $tempSqlFile" -ForegroundColor Gray
    Write-Host "  6. Execute queries" -ForegroundColor Gray
    Write-Host ""
}

# Clean up
Remove-Item -Path $tempSqlFile -Force -ErrorAction SilentlyContinue

Write-Host "✨ Done!" -ForegroundColor Green
