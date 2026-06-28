# Custom Domain Technical Implementation Guide

## Architecture Overview

This document describes the technical implementation of custom domain functionality in SafariDesk.

## Components

### 1. Database Model (`users/models/BusinessModel.py`)

**Model: `CustomDomains`**

```python
class CustomDomains(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="domains")
    domain = models.CharField(max_length=255, unique=True)
    is_primary = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    verification_method = models.CharField(max_length=20, choices=VERIFICATION_METHODS)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS)
    verification_token = models.CharField(max_length=64)
    verification_record_name = models.CharField(max_length=255)
    verification_record_value = models.CharField(max_length=255)
    last_verification_attempt = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
```

**Key Features:**
- **Unique Constraint**: Only one verified domain per business (enforced at DB level)
- **Verification Methods**: DNS TXT or CNAME
- **Audit Trail**: Tracks verification attempts and success timestamps

**Database Constraint:**
```python
constraints = [
    models.UniqueConstraint(
        fields=['business'],
        condition=models.Q(is_verified=True),
        name='one_verified_domain_per_business'
    )
]
```

### 2. Domain Verification Service (`util/DomainVerificationService.py`)

**Purpose**: Handles DNS verification using dnspython library.

**Methods:**
- `verify_dns_txt_record(domain)`: Verifies TXT records
- `verify_dns_cname_record(domain)`: Verifies CNAME records  
- `verify_domain(domain)`: Main verification orchestrator
- `check_dns_propagation(domain, record_type)`: DNS troubleshooting

**Verification Flow:**
```
1. Construct full DNS record name (_safaridesk-verify.domain.com)
2. Query DNS using dnspython
3. Compare found records with expected verification value
4. Update domain model with verification status
5. Set verified_at timestamp if successful
```

**DNS Resolution Settings:**
- Timeout: 10 seconds
- Lifetime: 10 seconds
- Handles: NXDOMAIN, NoAnswer, Timeout exceptions

### 3. Custom Domain Middleware (`shared/middleware/CustomDomainMiddleware.py`)

**Purpose**: Routes incoming requests to correct business based on custom domain.

**Flow:**
```
Request → Middleware → Extract Host → Check Cache → Query DB → Attach Business to Request
```

**Implementation Details:**

1. **Request Processing:**
   - Extracts hostname from request
   - Strips port number if present
   - Skips excluded hosts (localhost, default domains)

2. **Caching Strategy:**
   - Cache key: `custom_domain:{domain}`
   - Cache duration: 5 minutes
   - Caches business ID (not full object)
   - Caches negative results (1 minute) to prevent repeated DB queries

3. **Request Augmentation:**
   - `request.custom_domain`: The custom domain if found
   - `request.custom_domain_business`: Business object if found

4. **Excluded Hosts:**
   - localhost
   - 127.0.0.1
   - safaridesk.io (and subdomains)
   - api.safaridesk.io
   - app.safaridesk.io

**Cache Management:**
```python
@staticmethod
def clear_domain_cache(domain: str):
    """Clear cache for a specific domain"""
    cache_key = f"{CustomDomainMiddleware.CACHE_PREFIX}{domain}"
    cache.delete(cache_key)
```

### 4. API ViewSet (`users/views/CustomDomainView.py`)

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/domains/` | List all domains for business |
| POST | `/api/v1/domains/` | Create new domain |
| GET | `/api/v1/domains/{id}/` | Get domain details |
| PUT/PATCH | `/api/v1/domains/{id}/` | Update domain |
| DELETE | `/api/v1/domains/{id}/` | Delete domain |
| POST | `/api/v1/domains/{id}/verify/` | Verify domain ownership |
| POST | `/api/v1/domains/{id}/regenerate_token/` | Regenerate verification token |
| GET | `/api/v1/domains/{id}/check_verification/` | Check DNS without updating status |
| GET | `/api/v1/domains/{id}/setup_guide/` | Get detailed setup instructions |
| GET | `/api/v1/domains/status/` | Get business domain status |
| POST | `/api/v1/domains/check_dns/` | Check DNS propagation |

**Security:**
- All endpoints require authentication (`IsAuthenticated`)
- Domain ownership verified for all operations
- Users can only manage domains for their own business

**Validation:**
- One verified domain per business (enforced at serializer and model level)
- Domain format validation (no localhost, no IP addresses)
- Protocol stripping (removes http://, https://)

### 5. Serializers (`users/serializers/CustomDomainSerializer.py`)

**CustomDomainSerializer:**
- Includes verification instructions
- Read-only fields for security
- Domain format validation

**DomainCheckSerializer:**
- Used for DNS propagation checks
- Supports A, CNAME, TXT, MX records

### 6. Signals (`users/signals/custom_domain_signals.py`)

**Automatic Cache Clearing:**

```python
@receiver(post_save, sender=CustomDomains)
def clear_domain_cache_on_save(sender, instance, **kwargs):
    """Clear cache when domain is saved"""
    if instance.is_verified:
        CustomDomainMiddleware.clear_domain_cache(instance.domain)

@receiver(post_delete, sender=CustomDomains)
def clear_domain_cache_on_delete(sender, instance, **kwargs):
    """Clear cache when domain is deleted"""
    CustomDomainMiddleware.clear_domain_cache(instance.domain)
```

## Data Flow

### 1. Domain Addition Flow

```
User adds domain → Serializer validates → Check existing verified domains → 
Create domain record → Generate verification token → Return DNS instructions
```

### 2. Domain Verification Flow

```
User triggers verification → Service queries DNS → Compare records → 
Update domain status → Clear cache → Return result
```

### 3. Request Routing Flow

```
HTTP Request → Middleware extracts host → Check cache → Query DB → 
Attach business to request → Pass to view
```

## Security Considerations

### 1. Domain Ownership Verification

- **DNS Verification**: Only domain owners can add DNS records
- **Unique Tokens**: Cryptographically secure 32-byte tokens
- **Time-based Tracking**: Verification attempts are logged

### 2. Business Isolation

- **Database Constraint**: Prevents multiple verified domains
- **API Authorization**: Users can only access their business domains
- **Cache Isolation**: Each domain cached independently

### 3. Rate Limiting Considerations

- Verification attempts are logged but not rate-limited
- DNS queries have timeouts to prevent hanging
- Cache prevents excessive database queries

## Performance Optimizations

### 1. Caching Strategy

```python
# Cache structure
{
    "custom_domain:support.company.com": 123,  # business_id
    "custom_domain:help.another.com": 456
}
```

**Cache Invalidation:**
- On domain verification
- On domain update
- On domain deletion
- Automatic expiry after 5 minutes

### 2. Database Queries

- `select_related('business')` for joined queries
- Indexed fields: `domain` (unique index)
- Filtered queries: Only active businesses and verified domains

### 3. DNS Resolution

- Timeout settings prevent hanging
- Failed lookups are caught and logged
- DNS errors don't crash the application

## Deployment Checklist

### 1. Database Migration

```bash
python manage.py makemigrations users
python manage.py migrate users
```

### 2. Dependencies

```bash
pip install dnspython>=2.6.0
```

### 3. Middleware Configuration

Ensure `CustomDomainMiddleware` is in `MIDDLEWARE` setting:

```python
MIDDLEWARE = [
    # ... other middleware
    "shared.middleware.CustomDomainMiddleware.CustomDomainMiddleware",
    # ... other middleware
]
```

### 4. Cache Backend

Ensure cache backend is configured (Redis recommended for production):

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

### 5. DNS Configuration

Customers must add two DNS records:

1. **Verification Record** (temporary):
   - Used to verify domain ownership
   - Can be removed after verification

2. **Routing Record** (permanent):
   - Points domain to SafariDesk servers
   - Must remain active for traffic routing

### 6. SSL Certificates

For production, configure SSL certificate provisioning:
- Let's Encrypt integration (if available)
- Manual certificate upload
- Wildcard certificates for subdomains

## Monitoring & Logging

### Log Events

```python
# Domain creation
logger.info(f"Custom domain {domain} created for business {business}")

# Verification attempts
logger.info(f"Verifying TXT record for {record_name}")

# Verification success
logger.info(f"Domain {domain} successfully verified")

# Cache operations
logger.info(f"Cache cleared for domain: {domain}")

# Errors
logger.error(f"Error verifying domain {domain}: {error}")
```

### Metrics to Monitor

1. **Domain Operations:**
   - Domains added per day
   - Verification success rate
   - Average time to verification
   - Failed verification attempts

2. **Performance:**
   - Middleware processing time
   - Cache hit rate
   - DNS query latency
   - Database query count

3. **Business Metrics:**
   - Businesses using custom domains
   - Most common DNS providers
   - Geographic distribution of domains

## Troubleshooting

### Common Issues

1. **"Domain already registered"**
   - Domain exists in database
   - May be verified by another business
   - Solution: Contact support to release domain

2. **"DNS records not found"**
   - DNS not propagated yet (wait longer)
   - Incorrect record added
   - Wrong DNS provider/zone
   - Solution: Use `check_verification` endpoint for details

3. **"Verification failed"**
   - DNS timeout
   - Incorrect record value
   - Record type mismatch (TXT vs CNAME)
   - Solution: Check logs, verify DNS configuration

4. **"Domain not routing traffic"**
   - Main A/CNAME record not configured
   - DNS not propagated
   - Cache not cleared
   - Solution: Check routing DNS record, clear cache manually

### Debug Commands

```bash
# Check DNS propagation
dig _safaridesk-verify.support.company.com TXT +short

# Test middleware
curl -H "Host: support.company.com" http://localhost:8000/

# Clear all domain cache
python manage.py shell
>>> from django.core.cache import cache
>>> cache.delete_pattern('custom_domain:*')

# Check domain status
python manage.py shell
>>> from users.models import CustomDomains
>>> CustomDomains.objects.filter(is_verified=True)
```

## Testing

### Unit Tests

```python
# Test domain creation
def test_create_custom_domain():
    domain = CustomDomains.objects.create(
        business=business,
        domain="test.example.com",
        verification_method="dns_txt"
    )
    domain.generate_verification_token()
    assert domain.verification_token is not None

# Test verification
def test_domain_verification():
    service = DomainVerificationService()
    result = service.verify_domain(domain)
    assert result == True
    assert domain.is_verified == True

# Test middleware
def test_custom_domain_middleware(rf):
    request = rf.get('/', HTTP_HOST='support.company.com')
    middleware = CustomDomainMiddleware(get_response)
    middleware.process_request(request)
    assert request.custom_domain == 'support.company.com'
```

### Integration Tests

```python
# Test full flow
def test_domain_setup_flow(client):
    # Add domain
    response = client.post('/api/v1/domains/', {
        'domain': 'test.example.com',
        'verification_method': 'dns_txt'
    })
    assert response.status_code == 201
    
    # Verify (assuming DNS is set up)
    domain_id = response.data['id']
    response = client.post(f'/api/v1/domains/{domain_id}/verify/')
    assert response.status_code == 200
```

## API Examples

### Add Domain

```bash
curl -X POST https://api.safaridesk.io/api/v1/domains/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "support.company.com",
    "verification_method": "dns_txt"
  }'
```

### Check Verification (Non-destructive)

```bash
curl https://api.safaridesk.io/api/v1/domains/123/check_verification/ \
  -H "Authorization: Bearer TOKEN"
```

### Verify Domain

```bash
curl -X POST https://api.safaridesk.io/api/v1/domains/123/verify/ \
  -H "Authorization: Bearer TOKEN"
```

### Get Setup Guide

```bash
curl https://api.safaridesk.io/api/v1/domains/123/setup_guide/ \
  -H "Authorization: Bearer TOKEN"
```

## Future Enhancements

### Potential Features

1. **Multiple Domains**: Allow multiple verified domains per business
2. **Domain Aliases**: Support multiple domains pointing to same business
3. **Automatic SSL**: Integrate Let's Encrypt for automatic SSL certificates
4. **Health Checks**: Periodic verification of existing domains
5. **Email Integration**: Use custom domain for email notifications
6. **Subdomain Wildcards**: Support *.company.com patterns
7. **White-label Branding**: Full customization per domain
8. **Analytics**: Domain-specific traffic and usage analytics

### Performance Improvements

1. **CDN Integration**: Route traffic through CDN
2. **Edge Computing**: Process domain routing at edge
3. **Distributed Cache**: Use Redis cluster for caching
4. **Async Verification**: Background task for DNS verification
5. **Batch Operations**: Bulk domain operations

## Support & Maintenance

### Regular Tasks

1. **Monitor Verification Rates**: Track success/failure rates
2. **Update DNS Providers**: Keep provider instructions current
3. **Review Logs**: Check for unusual patterns or errors
4. **Cache Performance**: Monitor hit rates and adjust TTL
5. **Database Cleanup**: Archive old unverified domains

### Documentation Maintenance

- Keep provider instructions updated
- Add new DNS providers as needed
- Update troubleshooting guide based on support tickets
- Document any configuration changes

---

**Version**: 1.0  
**Last Updated**: December 15, 2025  
**Maintained By**: SafariDesk Development Team

