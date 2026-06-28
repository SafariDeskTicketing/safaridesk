"""
Domain Verification Service
Handles DNS verification for custom domains
"""
import dns.resolver
import logging
from django.utils import timezone
from users.models import CustomDomains

logger = logging.getLogger(__name__)


class DomainVerificationService:
    """Service to verify custom domain ownership via DNS records"""
    
    def __init__(self):
        """Initialize DNS resolver"""
        self.resolver = dns.resolver.Resolver()
        self.resolver.timeout = 10
        self.resolver.lifetime = 10

    def verify_dns_txt_record(self, domain: CustomDomains) -> bool:
        """
        Verify domain ownership via TXT record
        Returns True if verification succeeds
        """
        # Construct the full record name
        record_name = f"{domain.verification_record_name}.{domain.domain}"

        try:
            logger.info(f"[DNS TXT] Verifying TXT record for {record_name}")
            logger.debug(f"[DNS TXT] Expected value: {domain.verification_record_value}")
            
            # Query TXT records
            answers = self.resolver.resolve(record_name, 'TXT')
            
            logger.info(f"[DNS TXT] Found {len(answers)} TXT record(s)")
            
            # Check if our verification value exists
            for rdata in answers:
                txt_value = b''.join(rdata.strings).decode('utf-8')
                logger.debug(f"[DNS TXT] Found record: {txt_value}")
                
                if domain.verification_record_value in txt_value:
                    logger.info(f"[DNS TXT] ✓ Domain {domain.domain} verified successfully!")
                    return True
            
            logger.warning(f"[DNS TXT] ✗ Verification value not found in TXT records for {domain.domain}")
            return False
            
        except dns.resolver.NXDOMAIN:
            logger.error(f"[DNS TXT] ✗ Domain {record_name} does not exist (NXDOMAIN)")
            return False
        except dns.resolver.NoAnswer:
            logger.error(f"[DNS TXT] ✗ No TXT records found for {record_name}")
            return False
        except dns.resolver.Timeout:
            logger.error(f"[DNS TXT] ✗ DNS query timeout for {record_name}")
            return False
        except Exception as e:
            logger.error(f"[DNS TXT] ✗ Error verifying domain {domain.domain}: {str(e)}")
            return False
    
    def verify_dns_cname_record(self, domain: CustomDomains) -> bool:
        """
        Verify domain ownership via CNAME record
        Returns True if verification succeeds
        """
        # Construct the full record name
        record_name = f"{domain.verification_record_name}.{domain.domain}"

        try:
            logger.info(f"Verifying CNAME record for {record_name}")

            # Query CNAME records
            answers = self.resolver.resolve(record_name, 'CNAME')

            # Check if CNAME points to our verification domain
            for rdata in answers:
                cname_target = str(rdata.target).rstrip('.')
                logger.debug(f"Found CNAME record: {cname_target}")
                
                if domain.verification_record_value in cname_target:
                    logger.info(f"Domain {domain.domain} verified successfully via CNAME!")
                    return True
            
            logger.warning(f"Verification CNAME not found for {domain.domain}")
            return False
            
        except dns.resolver.NXDOMAIN:
            logger.error(f"Domain {record_name} does not exist")
            return False
        except dns.resolver.NoAnswer:
            logger.error(f"No CNAME records found for {record_name}")
            return False
        except dns.resolver.Timeout:
            logger.error(f"DNS query timeout for {record_name}")
            return False
        except Exception as e:
            logger.error(f"Error verifying domain {domain.domain}: {str(e)}")
            return False
    
    def verify_domain(self, domain: CustomDomains) -> bool:
        """
        Main verification method that dispatches to appropriate verification method
        Updates domain verification status
        """
        logger.info(f"[DOMAIN VERIFY] Starting verification for '{domain.domain}'")
        logger.info(f"[DOMAIN VERIFY] Method: {domain.verification_method}")
        logger.info(f"[DOMAIN VERIFY] Record Name: {domain.verification_record_name}")
        logger.info(f"[DOMAIN VERIFY] Expected Value: {domain.verification_record_value}")
        
        domain.last_verification_attempt = timezone.now()
        
        try:
            verified = False
            
            if domain.verification_method == 'dns_txt':
                verified = self.verify_dns_txt_record(domain)
            elif domain.verification_method == 'dns_cname':
                verified = self.verify_dns_cname_record(domain)
            else:
                logger.error(f"[DOMAIN VERIFY] ✗ Unknown verification method: {domain.verification_method}")
                domain.verification_status = 'failed'
                domain.save()
                return False
            
            if verified:
                domain.is_verified = True
                domain.verification_status = 'verified'
                domain.verified_at = timezone.now()
                logger.info(f"[DOMAIN VERIFY] ✓✓✓ Domain '{domain.domain}' successfully verified! ✓✓✓")
            else:
                domain.verification_status = 'failed'
                logger.warning(f"[DOMAIN VERIFY] ✗✗✗ Domain '{domain.domain}' verification failed ✗✗✗")
            
            domain.save()
            return verified
            
        except Exception as e:
            logger.error(f"[DOMAIN VERIFY] ✗ Error during domain verification for {domain.domain}: {str(e)}")
            domain.verification_status = 'failed'
            domain.save()
            return False
    
    def check_dns_propagation(self, domain: str, record_type: str = 'A') -> dict:
        """
        Check if DNS records exist for a domain
        Useful for troubleshooting
        """
        logger.info(f"[DNS CHECK] Checking {record_type} record for {domain}")
        try:
            answers = self.resolver.resolve(domain, record_type)
            records = [str(rdata) for rdata in answers]
            logger.info(f"[DNS CHECK] ✓ Found {len(records)} {record_type} record(s): {records}")
            return {
                'success': True,
                'records': records,
                'record_type': record_type
            }
        except dns.resolver.NXDOMAIN:
            error_msg = f"The DNS query name does not exist: {domain}."
            logger.warning(f"[DNS CHECK] ✗ NXDOMAIN: {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'record_type': record_type,
                'records': []
            }
        except dns.resolver.NoAnswer:
            error_msg = f"No {record_type} records found for {domain}"
            logger.warning(f"[DNS CHECK] ✗ NoAnswer: {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'record_type': record_type,
                'records': []
            }
        except dns.resolver.Timeout:
            error_msg = f"DNS query timeout for {domain}"
            logger.warning(f"[DNS CHECK] ✗ Timeout: {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'record_type': record_type,
                'records': []
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[DNS CHECK] ✗ Error: {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'record_type': record_type,
                'records': []
            }

