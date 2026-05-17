# 🌐 ONLINE DEPLOYMENT GUIDE - PAYMENT & SECURITY READY

## **YOUR ROADMAP TO GOING LIVE**

```
TIMELINE:

TODAY (Now):
  └─ Download all files
  └─ Deploy locally on Windows
  └─ Test system

TOMORROW (Day 2):
  └─ Deploy to cloud (DigitalOcean)
  └─ Get custom domain
  └─ Setup SSL/HTTPS
  └─ Integrate payment (Stripe)
  └─ Security hardening
  └─ TEST with payment

DAY 3:
  └─ Go live!
  └─ Share link: https://africaconvention2026.com
  └─ Guests can register & pay online
  └─ Auto-generate QR codes & badges

EVENT DAY:
  └─ Monitor real-time check-ins
  └─ Scan QR codes at entrance
  └─ Watch dashboard
  └─ Success! ✅
```

---

## 📋 WHAT YOU'LL HAVE ONLINE

### **Guest Perspective:**
```
Guest visits: https://africaconvention2026.com
    ↓
Sees event info + registration form
    ↓
Fills: Name, Email, Phone, Category
    ↓
Clicks: "Pay $50 to Register"
    ↓
Stripe payment modal opens
    ↓
Enters credit card
    ↓
Payment processed ✓
    ↓
Email received with:
  ├─ Welcome message
  ├─ Event badge (PDF)
  ├─ QR code (unique to them)
  └─ Check-in instructions
    ↓
At event entrance:
  ├─ Shows QR code to staff
  ├─ Staff scans with phone
  └─ Check-in instant! ✓
```

### **Your Perspective:**
```
Supervisor dashboard: https://africaconvention2026.com:4000
    ├─ Real-time statistics
    ├─ Total registered: 450
    ├─ Total checked-in: 380
    ├─ Check-in rate: 84%
    ├─ Revenue: $22,500
    └─ Recent check-ins (live)
```

---

## 🚀 STEP-BY-STEP DEPLOYMENT

### **STEP 1: CHOOSE CLOUD PROVIDER**

**Recommended: DigitalOcean**
- Cost: $6/month
- Time to deploy: 15 minutes
- Difficulty: Easy ⭐⭐

**Why DigitalOcean?**
- Simple dashboard
- Docker-friendly
- Affordable
- Good Africa connectivity
- No surprise charges

**Steps:**
1. Go to: https://www.digitalocean.com
2. Sign up with email
3. Verify + add payment method
4. Create Droplet
5. Choose: Ubuntu 22.04, $6/month size
6. Datacenter: Frankfurt (closest to Tanzania)
7. Create droplet
8. Wait 2 minutes for it to boot

**Your droplet IP:** 192.168.1.100 (example)

---

### **STEP 2: DEPLOY YOUR SYSTEM TO CLOUD**

**Connect to server:**
```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP
# Replace YOUR_DROPLET_IP with actual IP from DigitalOcean dashboard
```

**Install Docker:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify
docker --version
```

**Upload your project:**
```bash
# From your local machine (PowerShell), upload files:
scp -r C:\AfricaConvention\* root@YOUR_DROPLET_IP:/root/convention/

# Or if you have GitHub:
# ssh into server, then:
git clone https://github.com/yourname/africa-convention.git /root/convention
```

**Start the system:**
```bash
cd /root/convention
docker-compose up -d

# Verify all running
docker-compose ps
```

**Your system is now live at:**
```
http://YOUR_DROPLET_IP:9090   (ALFIO - registration)
http://YOUR_DROPLET_IP:3000   (QR scanner)
http://YOUR_DROPLET_IP:4000   (Supervisor dashboard)
```

Example:
```
http://192.168.1.100:9090
http://192.168.1.100:3000
http://192.168.1.100:4000
```

---

### **STEP 3: GET A CUSTOM DOMAIN**

**Buy a domain:**
1. Go to: https://www.namecheap.com (cheapest)
2. Search for: `africaconvention2026.com`
3. Buy domain (~$12/year)
4. Verify email

**Point domain to DigitalOcean:**
1. In Namecheap, go to DNS settings
2. Change nameservers to:
   ```
   ns1.digitalocean.com
   ns2.digitalocean.com
   ns3.digitalocean.com
   ```
3. Wait 24 hours for propagation

**In DigitalOcean:**
1. Dashboard → Networking → Domains
2. Add Domain: africaconvention2026.com
3. Select your Droplet
4. Create

**Your system is now at:**
```
http://africaconvention2026.com:9090
http://africaconvention2026.com:3000
http://africaconvention2026.com:4000
```

---

### **STEP 4: ENABLE HTTPS (SSL SECURITY)**

**SSH into server:**
```bash
ssh root@africaconvention2026.com

# Install Let's Encrypt (free SSL)
apt-get update
apt-get install certbot python3-certbot-nginx

# Get certificate (automatic)
certbot certonly --standalone -d africaconvention2026.com

# Follow prompts and you'll have SSL!
```

**Update nginx.conf:**
```
Add these lines to nginx.conf:

server {
    listen 443 ssl http2;
    server_name africaconvention2026.com;
    
    ssl_certificate /etc/letsencrypt/live/africaconvention2026.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/africaconvention2026.com/privkey.pem;
    
    # Your existing proxy_pass, etc.
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name africaconvention2026.com;
    return 301 https://$server_name$request_uri;
}
```

**Restart nginx:**
```bash
docker-compose restart nginx
```

**Now secure:**
```
https://africaconvention2026.com:9090  ✅
https://africaconvention2026.com:3000  ✅
https://africaconvention2026.com:4000  ✅
```

---

### **STEP 5: INTEGRATE PAYMENT (STRIPE)**

**Get Stripe Account:**
1. Go to: https://stripe.com
2. Sign up
3. Verify business
4. Get API keys in Dashboard

**Add to .env file:**
```env
STRIPE_PUBLIC_KEY=pk_live_YOUR_KEY
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
PAYMENT_AMOUNT=5000  # $50 in cents
CURRENCY=usd
```

**Install Stripe:**
```bash
npm install stripe @stripe/react-stripe-js @stripe/js
```

**Create Payment Form (React):**

Add to your registration page:

```jsx
import { loadStripe } from '@stripe/js';

export default function PaymentRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    category: 'Youth'
  });

  const handlePayment = async () => {
    // Create payment intent on backend
    const response = await fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const { clientSecret } = await response.json();

    // Process payment with Stripe
    const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLIC);
    
    const result = await stripe.confirmCardPayment(clientSecret);

    if (result.paymentIntent.status === 'succeeded') {
      alert('Payment successful!');
      // Automatically generate badge and QR
      generateBadge(formData);
    }
  };

  return (
    <div>
      <input 
        placeholder="Full Name"
        onChange={(e) => setFormData({...formData, name: e.target.value})}
      />
      <input 
        placeholder="Email"
        onChange={(e) => setFormData({...formData, email: e.target.value})}
      />
      <input 
        placeholder="Phone"
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
      />
      <select onChange={(e) => setFormData({...formData, category: e.target.value})}>
        <option>Youth</option>
        <option>Speaker</option>
        <option>Business</option>
        <option>Leader</option>
      </select>
      
      <button onClick={handlePayment}>
        Pay $50 to Register
      </button>
    </div>
  );
}
```

**Backend Payment Processing:**

Add to `qr-server-api.js`:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/payment/create-intent', async (req, res) => {
  const { name, email, phone, category, amount = 5000 } = req.body;

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: { name, email, phone, category }
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment/confirm', async (req, res) => {
  const { paymentIntentId, name, email, phone, category } = req.body;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status === 'succeeded') {
      // Create attendee in database
      const result = await pool.query(
        `INSERT INTO attendees (name, email, phone, category, registration_source)
         VALUES ($1, $2, $3, $4, 'payment')
         RETURNING id, name, email`,
        [name, email, phone, category]
      );

      const attendee = result.rows[0];

      // Generate QR code and badge
      const qrCode = await QRCode.toDataURL(attendee.id.toString());

      // Send email with badge
      await sendEmailWithBadge(email, name, qrCode);

      res.json({
        success: true,
        message: 'Payment confirmed! Check your email for badge.',
        qr_code: qrCode
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### **STEP 6: SECURITY HARDENING**

**Update .env with production secrets:**
```env
DB_PASSWORD=your_very_secure_password_NOT_default
ADMIN_KEY=your_secret_key_NOT_default
STRIPE_SECRET_KEY=sk_live_... (NEVER share!)
JWT_SECRET=random_secret_string
SESSION_SECRET=random_secret_string

CORS_ORIGIN=https://africaconvention2026.com
NODE_ENV=production
```

**Setup firewall (DigitalOcean):**
```
Allow:
  ├─ Port 80 (HTTP → redirect to HTTPS)
  ├─ Port 443 (HTTPS)
  └─ Port 22 (SSH from your IP only)

Block:
  ├─ Port 5432 (Database - internal only)
  └─ Everything else
```

**Database backup:**
```bash
# Add to server cron job
0 2 * * * docker-compose exec shared-db pg_dump -U admin africa_convention > /backups/db_$(date +\%Y\%m\%d).sql
```

---

## ✅ FINAL CHECKLIST

- [ ] System deployed to DigitalOcean
- [ ] Custom domain pointing to server
- [ ] HTTPS/SSL certificate installed
- [ ] Payment integrated with Stripe
- [ ] All default passwords changed
- [ ] .env configured with production secrets
- [ ] Database backups running
- [ ] Firewall rules configured
- [ ] Test payment (use Stripe test card)
- [ ] Test full flow (register → pay → badge → QR)
- [ ] Share link with guests

---

## 🎯 SHARE WITH GUESTS

Send this link to all interested attendees:

```
🎫 2026 AFRICA CONVENTION
📝 Register & Pay Online

Click here: https://africaconvention2026.com

What to do:
1. Fill registration form
2. Choose category
3. Pay $50 (or custom amount)
4. Get instant QR code & badge
5. Print or screenshot QR code
6. Bring to event (June 18-22)
7. Show at entrance for instant check-in

Questions? Contact: wccm.tz@gmail.com

See you there! 🎉
```

---

## 💰 COST BREAKDOWN

```
DigitalOcean:        $6/month
Domain:              $1.25/month ($15/year)
SSL:                 FREE
Stripe fee:          2.2% + $0.30 per transaction

Example: 500 attendees × $50
├─ Revenue:          $25,000
├─ Stripe fees:      ~$575
├─ Server costs:     ~$10
└─ NET:              ~$24,415
```

---

## 🎊 YOU'RE LIVE!

After these steps, guests can:

1. Visit: https://africaconvention2026.com
2. Register online
3. Pay with credit card (Stripe)
4. Get QR code + badge instantly
5. Come to event with QR code
6. Scan at entrance = instant check-in
7. You monitor everything real-time

**Everything automated. No manual entry. Professional. Secure. Online.** ✅

---

For detailed steps on each section, see:
- **ONLINE-DEPLOYMENT-GUIDE.md** (this file)
- **FILE-MANIFEST.md** (what to download)
- **INTEGRATION-GUIDE.md** (system architecture)
- **BADGE-SYSTEM-GUIDE.md** (badge generation)

Good luck! 🚀
