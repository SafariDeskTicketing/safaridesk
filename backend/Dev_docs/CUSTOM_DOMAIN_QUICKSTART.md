# Custom Domain Quick Start Guide

## 5-Minute Setup

### For Customers

#### 1. Add Your Domain (1 minute)
1. Log in to SafariDesk
2. Go to **Settings → Custom Domain**
3. Click **Add Custom Domain**
4. Enter: `support.yourcompany.com`
5. Choose: **TXT Record** (recommended)

#### 2. Add DNS Record (2 minutes)
Copy the DNS record shown and add it to your DNS provider:

```
Type: TXT
Name: _safaridesk-verify
Value: [copy from SafariDesk]
TTL: 3600
```

**Where to add:**
- **Cloudflare**: DNS → Records → Add record
- **GoDaddy**: My Products → DNS → Add
- **Namecheap**: Domain → Advanced DNS → Add New Record
- **Route 53**: Hosted Zones → Create Record

#### 3. Wait & Verify (10-30 minutes)
1. Wait for DNS propagation (10-30 minutes)
2. Click **Check Verification** to test
3. Click **Verify Domain** when ready

#### 4. Point Domain to SafariDesk (2 minutes)
Add this record to route traffic:

```
Type: A or CNAME
Name: support
Value: [get from SafariDesk support]
TTL: 3600
```

#### Done! 🎉
Your custom domain is now active.

---

## For Developers

### Quick Integration

#### Install Dependencies
```bash
pip install dnspython
```

#### Add Domain via API
```bash
curl -X POST https://api.safaridesk.io/api/v1/domains/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "support.company.com",
    "verification_method": "dns_txt"
  }'
```

#### Check Status
```bash
curl https://api.safaridesk.io/api/v1/domains/status/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Verify Domain
```bash
curl -X POST https://api.safaridesk.io/api/v1/domains/{id}/verify/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### DNS Not Found?
```bash
# Check if DNS record exists
dig _safaridesk-verify.support.yourcompany.com TXT +short

# Should return: "safaridesk-verification=..."
```

### Still Not Working?
1. Wait longer (DNS can take up to 48 hours)
2. Check [DNS Checker](https://dnschecker.org)
3. Verify correct record type (TXT vs CNAME)
4. Contact support@safaridesk.io

---

## Important Notes

✅ **One Domain Per Business**: Each business can have only one verified custom domain

✅ **Verification Required**: Domains must be verified before routing traffic

✅ **DNS Propagation**: Allow 10-30 minutes for DNS changes (can take up to 48 hours)

✅ **Two Records Needed**: 
   - Verification record (can be removed after verification)
   - Routing record (must stay active)

---

## Need More Help?

📖 **Full Documentation**: See `CUSTOM_DOMAIN_SETUP.md`

📧 **Support**: support@safaridesk.io

🌐 **DNS Tools**:
- https://dnschecker.org
- https://www.whatsmydns.net
- https://mxtoolbox.com

---

**Last Updated**: December 15, 2025

