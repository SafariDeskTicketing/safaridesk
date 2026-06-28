# Custom Domain Setup Guide

## Overview

SafariDesk allows businesses to use their own custom domains (e.g., `support.yourcompany.com`) instead of the default SafariDesk domain. This provides a branded experience for your customers and increases trust.

## Features

- ✅ Custom domain support per business
- ✅ DNS verification (TXT or CNAME)
- ✅ One verified domain per business
- ✅ Automatic traffic routing
- ✅ Domain ownership verification
- ✅ Multiple DNS providers supported
- ✅ Real-time verification status

## Requirements

- A domain name that you own
- Access to your domain's DNS management panel
- An active SafariDesk business account

## How It Works

### 1. Architecture

```
Customer Request → Custom Domain Middleware → Business Identification → Request Processing
                        ↓
                 DNS Verification
                        ↓
                 Cache Layer (5 min)
```

### 2. Domain Verification Process

1. **Add Domain**: Enter your custom domain (e.g., `support.company.com`)
2. **Get Verification Records**: System generates unique DNS records
3. **Configure DNS**: Add records to your domain provider
4. **Verify**: System checks DNS propagation
5. **Active**: Domain is verified and starts routing traffic

### 3. One Domain Per Business

- Each business can have **only one verified custom domain**
- You can have multiple pending (unverified) domains
- To change domains, delete the existing verified domain first
- Database constraint ensures this rule is enforced

## Setup Instructions for Customers

### Step 1: Add Your Custom Domain

1. Log in to your SafariDesk business account
2. Navigate to **Settings → Custom Domain**
3. Click **Add Custom Domain**
4. Enter your domain (e.g., `support.yourcompany.com`)
5. Choose verification method:
   - **TXT Record** (Recommended) - Works with all DNS providers
   - **CNAME Record** - Alternative method

### Step 2: Get Verification Records

After adding your domain, you'll receive DNS record details:

**For TXT Record Method:**
```
Type: TXT
Name: _safaridesk-verify
Value: safaridesk-verification=<your-unique-token>
TTL: 3600 (or default)
```

**For CNAME Record Method:**
```
Type: CNAME
Name: _safaridesk-verify
Value: verify.safaridesk.io
TTL: 3600 (or default)
```

### Step 3: Configure DNS at Your Provider

See provider-specific instructions below.

### Step 4: Wait for DNS Propagation

- DNS changes can take 5-30 minutes to propagate
- In rare cases, up to 48 hours
- Use the "Check Verification" button to test if records are found

### Step 5: Verify Domain

1. After DNS propagation, click **Verify Domain**
2. System will check DNS records
3. If successful, your domain is now active!

### Step 6: Configure Domain Routing (Required)

After verification, you need to point your domain to SafariDesk servers:

**Option A: Using A Record (Recommended)**
```
Type: A
Name: support (or your subdomain)
Value: <SafariDesk-Server-IP>
TTL: 3600
```

**Option B: Using CNAME Record**
```
Type: CNAME
Name: support (or your subdomain)
Value: app.safaridesk.io
TTL: 3600
```

> **Important**: Replace `<SafariDesk-Server-IP>` with the actual IP provided by SafariDesk support.

## DNS Provider-Specific Instructions

### Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Go to **DNS → Records**
4. Click **Add record**
5. Set values as shown in Step 2 above
6. Set **Proxy status** to "DNS only" (gray cloud) for verification record
7. Click **Save**

### GoDaddy

1. Log in to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products → Domain → DNS**
3. Click **Add** → Select record type (TXT or CNAME)
4. Enter Host and Value as shown in Step 2
5. Set TTL to 1 Hour
6. Click **Save**

### Namecheap

1. Log in to [Namecheap](https://www.namecheap.com)
2. Go to **Domain List → Manage → Advanced DNS**
3. Click **Add New Record**
4. Select record type (TXT or CNAME)
5. Enter Host and Value
6. Set TTL to Automatic
7. Click **Save**

### AWS Route 53

1. Log in to [AWS Console](https://console.aws.amazon.com)
2. Go to **Route 53 → Hosted Zones**
3. Select your domain
4. Click **Create Record**
5. Enter record details
6. Click **Create records**

### Google Domains

1. Log in to [Google Domains](https://domains.google.com)
2. Select your domain
3. Go to **DNS settings**
4. Scroll to **Custom records**
5. Add the record details
6. Click **Add**

### Other Providers

The process is similar for all DNS providers:
1. Find DNS management section
2. Add a new record (TXT or CNAME)
3. Enter the name and value provided
4. Save changes

## Troubleshooting

### DNS Records Not Found

**Problem**: Verification fails because DNS records aren't found.

**Solutions**:
1. Wait longer (DNS can take up to 48 hours)
2. Check DNS propagation using online tools:
   - https://dnschecker.org
   - https://www.whatsmydns.net
3. Verify you added the record correctly
4. Ensure there are no typos in the record value
5. Try regenerating the verification token

### Command Line Verification

You can check DNS records using terminal commands:

```bash
# Check TXT record
dig _safaridesk-verify.support.yourcompany.com TXT +short
nslookup -type=TXT _safaridesk-verify.support.yourcompany.com

# Check CNAME record
dig _safaridesk-verify.support.yourcompany.com CNAME +short
nslookup -type=CNAME _safaridesk-verify.support.yourcompany.com
```

### Domain Already Registered

**Problem**: Error says domain is already registered.

**Solutions**:
1. The domain may be verified by another business
2. Contact SafariDesk support to release the domain
3. Verify you own the domain

### Already Have a Verified Domain

**Problem**: "Your business already has a verified custom domain"

**Solution**:
1. Go to Custom Domain settings
2. Delete the existing verified domain
3. Add your new domain

### Domain Not Routing Traffic

**Problem**: Domain is verified but not working.

**Solutions**:
1. Ensure you've configured the main A or CNAME record (Step 6)
2. Clear your browser cache
3. Try in incognito/private mode
4. Check that the domain points to SafariDesk servers
5. Wait for DNS propagation of main record

## API Endpoints

For developers integrating custom domains:

### List Domains
```http
GET /api/v1/domains/
Authorization: Bearer <token>
```

### Add Domain
```http
POST /api/v1/domains/
Authorization: Bearer <token>
Content-Type: application/json

{
  "domain": "support.company.com",
  "verification_method": "dns_txt"
}
```

### Verify Domain
```http
POST /api/v1/domains/{id}/verify/
Authorization: Bearer <token>
```

### Check Verification Status (Non-destructive)
```http
GET /api/v1/domains/{id}/check_verification/
Authorization: Bearer <token>
```

### Get Setup Guide
```http
GET /api/v1/domains/{id}/setup_guide/
Authorization: Bearer <token>
```

### Get Domain Status
```http
GET /api/v1/domains/status/
Authorization: Bearer <token>
```

### Delete Domain
```http
DELETE /api/v1/domains/{id}/
Authorization: Bearer <token>
```

### Regenerate Token
```http
POST /api/v1/domains/{id}/regenerate_token/
Authorization: Bearer <token>
```

### Check DNS Propagation
```http
POST /api/v1/domains/check_dns/
Authorization: Bearer <token>
Content-Type: application/json

{
  "domain": "_safaridesk-verify.support.company.com",
  "record_type": "TXT"
}
```

## Security & Best Practices

### Domain Verification

- Verification tokens are cryptographically secure (32 bytes)
- Each domain must be verified before routing traffic
- Only domain owners can add DNS records (proving ownership)
- Verification records can be removed after successful verification

### Traffic Routing

- Middleware checks custom domains on every request
- Results are cached for 5 minutes for performance
- Only verified domains with active businesses route traffic
- Inactive or unverified domains are ignored

### Rate Limiting

- Verification attempts are logged with timestamps
- Failed verifications don't lock the domain
- You can retry verification immediately after DNS propagation

### Data Privacy

- Domain information is private to each business
- Only business owners/admins can manage domains
- Domain verification status is visible in the dashboard

## Technical Implementation

### Database Constraint

A unique constraint ensures only one verified domain per business:

```python
constraints = [
    models.UniqueConstraint(
        fields=['business'],
        condition=models.Q(is_verified=True),
        name='one_verified_domain_per_business'
    )
]
```

### Middleware Processing

1. Extract host from incoming request
2. Check if host is excluded (localhost, default domains)
3. Query database for matching verified domain
4. Use cache to avoid repeated database queries
5. Attach business to request object

### Verification Methods

**TXT Record**:
- Record: `_safaridesk-verify.yourdomain.com`
- Value: `safaridesk-verification=<token>`
- Provides cryptographic proof of ownership

**CNAME Record**:
- Record: `_safaridesk-verify.yourdomain.com`
- Value: `verify.safaridesk.io`
- Simple delegation method

## Support

### Common Issues

1. **DNS Propagation**: Most issues resolve within 30 minutes
2. **Wrong Provider Section**: Ensure you're editing the correct domain
3. **Subdomain vs Root**: Use subdomain (e.g., `support.company.com`) not root (`company.com`)

### Getting Help

If you encounter issues:

1. Check this guide thoroughly
2. Use the "Check Verification" feature to see DNS status
3. Try online DNS checker tools
4. Contact SafariDesk support with:
   - Your domain name
   - DNS provider name
   - Screenshots of DNS settings
   - Error messages received

### Contact

- **Email**: support@safaridesk.io
- **Documentation**: https://docs.safaridesk.io
- **Status Page**: https://status.safaridesk.io

## Frequently Asked Questions

### Can I use my root domain (company.com)?

It's recommended to use a subdomain (e.g., `support.company.com`) to avoid conflicts with your main website.

### How many domains can I have?

Each business can have **one verified custom domain** at a time. You can change it by deleting the current domain and adding a new one.

### Do I need to keep the verification record?

You can remove the verification DNS record (_safaridesk-verify) after successful verification. However, keep the main A or CNAME record that points to SafariDesk servers.

### What happens if verification fails?

You can retry verification at any time. Check DNS propagation and ensure records are correct, then click "Verify Domain" again.

### Can I transfer a domain between businesses?

Yes, delete the domain from the current business first, then add it to the new business and verify.

### Does this affect my main website?

No, if you use a subdomain like `support.company.com`, your main website at `company.com` remains unaffected.

### Is SSL/HTTPS supported?

Yes, SafariDesk automatically provisions SSL certificates for verified custom domains (contact support for details).

### What about email on my domain?

Custom domain setup for SafariDesk doesn't affect email. Your email MX records remain separate.

## Changelog

### Version 1.0 (December 2025)
- Initial release
- TXT and CNAME verification methods
- One domain per business constraint
- Middleware for automatic routing
- Comprehensive API endpoints
- Provider-specific setup guides

---

**Last Updated**: December 15, 2025
**Version**: 1.0

