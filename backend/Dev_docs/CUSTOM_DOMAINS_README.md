# Custom Domain Documentation Index

## Overview

SafariDesk supports custom domains, allowing businesses to use their own branded domains (e.g., `support.yourcompany.com`) instead of the default SafariDesk domain.

## Documentation Files

### 1. [CUSTOM_DOMAIN_QUICKSTART.md](./CUSTOM_DOMAIN_QUICKSTART.md)
**For: Customers & Quick Setup**

5-minute guide for customers to set up custom domains quickly. Includes:
- Step-by-step setup process
- DNS provider examples
- Common troubleshooting tips
- Command-line verification

**Use this when:** You want to quickly set up a custom domain.

---

### 2. [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md)
**For: Customers & Developers**

Comprehensive customer guide with detailed instructions. Includes:
- Full setup workflow
- Provider-specific instructions for 6+ DNS providers
- Verification methods (TXT and CNAME)
- Troubleshooting guide
- API documentation
- Security best practices
- FAQ section

**Use this when:** You need detailed setup instructions or troubleshooting help.

---

### 3. [CUSTOM_DOMAIN_IMPLEMENTATION.md](./CUSTOM_DOMAIN_IMPLEMENTATION.md)
**For: Developers & System Administrators**

Technical implementation guide for developers. Includes:
- Architecture overview
- Component documentation
- Data flow diagrams
- Security considerations
- Performance optimizations
- Deployment checklist
- Monitoring & logging
- Testing strategies
- API examples

**Use this when:** You're implementing, maintaining, or debugging the custom domain system.

---

## Quick Reference

### Customer Flow
1. Add domain in SafariDesk dashboard
2. Get DNS verification record
3. Add record to DNS provider
4. Wait for DNS propagation (5-30 minutes)
5. Verify domain in SafariDesk
6. Add routing DNS record
7. Done! Custom domain is active

### Developer Flow
1. Model: `CustomDomains` in `users/models/BusinessModel.py`
2. Service: `DomainVerificationService` in `util/DomainVerificationService.py`
3. Middleware: `CustomDomainMiddleware` in `shared/middleware/CustomDomainMiddleware.py`
4. Views: `CustomDomainViewSet` in `users/views/CustomDomainView.py`
5. Signals: Auto cache clearing in `users/signals/custom_domain_signals.py`

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/domains/` | GET | List domains |
| `/api/v1/domains/` | POST | Add domain |
| `/api/v1/domains/{id}/` | GET | Get domain |
| `/api/v1/domains/{id}/` | DELETE | Delete domain |
| `/api/v1/domains/{id}/verify/` | POST | Verify domain |
| `/api/v1/domains/{id}/check_verification/` | GET | Check DNS status |
| `/api/v1/domains/{id}/setup_guide/` | GET | Get setup guide |
| `/api/v1/domains/status/` | GET | Get business status |

## Key Features

✅ **One Domain Per Business**: Database constraint ensures one verified domain per business

✅ **DNS Verification**: TXT or CNAME record verification for domain ownership

✅ **Automatic Routing**: Middleware routes traffic based on custom domain

✅ **Caching**: 5-minute cache for performance (auto-cleared on updates)

✅ **Security**: Only domain owners can verify (must add DNS records)

✅ **Comprehensive API**: Full REST API for integration

## Technical Stack

- **Backend**: Django (Python)
- **DNS Library**: dnspython
- **Cache**: Django cache framework (Redis recommended)
- **Database**: PostgreSQL (with unique constraints)
- **Authentication**: Token-based (Django REST Framework)

## Support

### For Customers
- **Quick Setup**: See `CUSTOM_DOMAIN_QUICKSTART.md`
- **Detailed Guide**: See `CUSTOM_DOMAIN_SETUP.md`
- **Support Email**: support@safaridesk.io

### For Developers
- **Implementation Guide**: See `CUSTOM_DOMAIN_IMPLEMENTATION.md`
- **API Docs**: See `CUSTOM_DOMAIN_SETUP.md` (API Endpoints section)
- **Source Code**: See implementation files listed above

## Getting Started

### Customers
```bash
# 1. Add your domain in SafariDesk dashboard
# 2. Get DNS records from dashboard
# 3. Add to your DNS provider

# Check if DNS is propagated:
dig _safaridesk-verify.support.yourcompany.com TXT +short

# 4. Click "Verify Domain" in dashboard
```

### Developers
```python
# Install dependencies
pip install dnspython>=2.6.0

# Run migrations
python manage.py migrate

# Test the setup
from users.models import CustomDomains
from util.DomainVerificationService import DomainVerificationService

# Create domain
domain = CustomDomains.objects.create(
    business=business,
    domain="test.example.com",
    verification_method="dns_txt"
)
domain.generate_verification_token()

# Verify (after DNS is set up)
service = DomainVerificationService()
service.verify_domain(domain)
```

## Files & Locations

### Models
- `users/models/BusinessModel.py` - CustomDomains model

### Services
- `util/DomainVerificationService.py` - DNS verification

### Middleware
- `shared/middleware/CustomDomainMiddleware.py` - Request routing

### Views
- `users/views/CustomDomainView.py` - API endpoints

### Serializers
- `users/serializers/CustomDomainSerializer.py` - Data serialization

### Routes
- `users/routes/custom_domains.py` - URL routing

### Signals
- `users/signals/custom_domain_signals.py` - Cache management

### Configuration
- `RNSafarideskBack/settings/base.py` - Middleware configuration
- `RNSafarideskBack/urls.py` - URL includes

## Version History

### Version 1.0 (December 2025)
- Initial implementation
- TXT and CNAME verification methods
- One domain per business constraint
- Middleware for automatic routing
- Comprehensive documentation
- API endpoints
- Cache management with signals
- Provider-specific guides for 6+ DNS providers

---

**Last Updated**: December 15, 2025  
**Version**: 1.0

