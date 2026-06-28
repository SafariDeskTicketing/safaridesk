"""
Custom Domain Views
"""
import logging
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import IntegrityError

from users.models import CustomDomains
from users.serializers.CustomDomainSerializer import (
    CustomDomainSerializer,
    DomainCheckSerializer
)
from util.DomainVerificationService import DomainVerificationService
from shared.middleware.CustomDomainMiddleware import CustomDomainMiddleware

logger = logging.getLogger(__name__)


class CustomDomainViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing custom domains
    """
    serializer_class = CustomDomainSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return domains for the authenticated user's business"""
        if not self.request.user.business:
            return CustomDomains.objects.none()

        return CustomDomains.objects.filter(
            business=self.request.user.business
        ).order_by('-created_at')

    def perform_create(self, serializer):
        """Create new custom domain and generate verification token"""
        try:
            business = self.request.user.business
            domain_name = serializer.validated_data.get('domain')
            
            logger.info(f"[DOMAIN CREATE] Starting domain creation for '{domain_name}' by business '{business.name}' (ID: {business.id})")
            
            # Check if business already has a verified domain
            existing_verified = CustomDomains.objects.filter(
                business=business,
                is_verified=True
            ).exists()

            if existing_verified:
                logger.warning(f"[DOMAIN CREATE] Business '{business.name}' already has a verified domain")
                raise serializers.ValidationError(
                    "Your business already has a verified custom domain. "
                    "Please remove the existing domain before adding a new one."
                )

            # Save the domain
            domain = serializer.save(business=business)
            logger.info(f"[DOMAIN CREATE] Domain '{domain.domain}' saved with ID {domain.id}")

            # Generate verification token
            domain.generate_verification_token()
            logger.info(f"[DOMAIN CREATE] Verification token generated for '{domain.domain}'")
            logger.debug(f"[DOMAIN CREATE] Record Name: {domain.verification_record_name}")
            logger.debug(f"[DOMAIN CREATE] Record Value: {domain.verification_record_value}")

            logger.info(
                f"[DOMAIN CREATE] ✓ Successfully created domain {domain.domain} for business {business.name}"
            )

        except IntegrityError as e:
            logger.error(f"[DOMAIN CREATE] ✗ IntegrityError creating domain: {str(e)}")
            raise serializers.ValidationError(
                "This domain is already registered or your business already has a verified domain."
            )

    def perform_destroy(self, instance):
        """Delete domain and clear cache"""
        domain_name = instance.domain
        business_name = instance.business.name

        # Clear cache before deletion
        CustomDomainMiddleware.clear_domain_cache(domain_name)

        instance.delete()

        logger.info(f"Custom domain {domain_name} deleted for business {business_name}")

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Verify domain ownership
        POST /api/v1/domains/{id}/verify/
        """
        domain = self.get_object()
        
        logger.info(f"[DOMAIN VERIFY] Starting verification for domain '{domain.domain}' (ID: {domain.id})")
        logger.info(f"[DOMAIN VERIFY] Business: {domain.business.name} (ID: {domain.business.id})")
        logger.info(f"[DOMAIN VERIFY] Method: {domain.verification_method}")

        # Check if domain belongs to user's business
        if domain.business != request.user.business:
            logger.warning(f"[DOMAIN VERIFY] ✗ Permission denied: domain belongs to different business")
            return Response(
                {"error": "You don't have permission to verify this domain"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if already verified
        if domain.is_verified:
            logger.info(f"[DOMAIN VERIFY] Domain '{domain.domain}' is already verified")
            return Response(
                {"message": "Domain is already verified"},
                status=status.HTTP_200_OK
            )

        # Perform verification
        logger.info(f"[DOMAIN VERIFY] Initiating DNS verification for '{domain.domain}'...")
        verification_service = DomainVerificationService()
        verified = verification_service.verify_domain(domain)

        if verified:
            logger.info(f"[DOMAIN VERIFY] ✓ Domain '{domain.domain}' verified successfully!")
            logger.info(f"[DOMAIN VERIFY] Clearing cache for domain '{domain.domain}'")
            
            # Clear cache to ensure new domain is recognized
            CustomDomainMiddleware.clear_domain_cache(domain.domain)

            return Response({
                "message": "Domain verified successfully!",
                "domain": CustomDomainSerializer(domain).data
            }, status=status.HTTP_200_OK)
        else:
            logger.warning(f"[DOMAIN VERIFY] ✗ Verification failed for '{domain.domain}'")
            logger.warning(f"[DOMAIN VERIFY] Status: {domain.verification_status}")
            return Response({
                "error": "Domain verification failed. Please check your DNS records and try again.",
                "verification_status": domain.verification_status,
                "instructions": CustomDomainSerializer(domain).data.get('verification_instructions')
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def regenerate_token(self, request, pk=None):
        """
        Regenerate verification token for a domain
        POST /api/v1/domains/{id}/regenerate_token/
        """
        domain = self.get_object()

        # Check if domain belongs to user's business
        if domain.business != request.user.business:
            return Response(
                {"error": "You don't have permission to modify this domain"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Don't allow regeneration for verified domains
        if domain.is_verified:
            return Response(
                {"error": "Cannot regenerate token for verified domain"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Regenerate token
        domain.generate_verification_token()

        logger.info(f"Verification token regenerated for domain {domain.domain}")

        return Response({
            "message": "Verification token regenerated successfully",
            "domain": CustomDomainSerializer(domain).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def check_dns(self, request):
        """
        Check DNS propagation for troubleshooting
        POST /api/v1/domains/check_dns/
        Body: {"domain": "example.com", "record_type": "A"}
        """
        serializer = DomainCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        domain = serializer.validated_data['domain']
        record_type = serializer.validated_data['record_type']

        verification_service = DomainVerificationService()
        result = verification_service.check_dns_propagation(domain, record_type)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def status(self, request):
        """
        Get current domain status for the business
        GET /api/v1/domains/status/
        """
        if not request.user.business:
            return Response(
                {"error": "User is not associated with a business"},
                status=status.HTTP_400_BAD_REQUEST
            )

        domains = self.get_queryset()
        verified_domain = domains.filter(is_verified=True).first()

        return Response({
            "business": request.user.business.name,
            "has_custom_domain": verified_domain is not None,
            "custom_domain": verified_domain.domain if verified_domain else None,
            "total_domains": domains.count(),
            "pending_domains": domains.filter(verification_status='pending').count(),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def check_verification(self, request, pk=None):
        """
        Check if domain can be verified (non-destructive check)
        Frontend can call this to check DNS propagation status
        GET /api/v1/domains/{id}/check_verification/

        Returns:
        - dns_records_found: boolean
        - can_verify: boolean
        - verification_details: object with DNS check results
        - domain: full domain object with instructions
        """
        domain = self.get_object()
        
        logger.info(f"[DOMAIN CHECK] Checking verification status for '{domain.domain}' (ID: {domain.id})")

        # Check if domain belongs to user's business
        if domain.business != request.user.business:
            logger.warning(f"[DOMAIN CHECK] ✗ Permission denied for domain '{domain.domain}'")
            return Response(
                {"error": "You don't have permission to check this domain"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Already verified
        if domain.is_verified:
            logger.info(f"[DOMAIN CHECK] Domain '{domain.domain}' is already verified")
            return Response({
                "is_verified": True,
                "message": "Domain is already verified",
                "domain": CustomDomainSerializer(domain).data
            }, status=status.HTTP_200_OK)

        # Check DNS without updating domain status
        verification_service = DomainVerificationService()

        try:
            # Construct the full record name
            record_name = f"{domain.verification_record_name}.{domain.domain}"
            record_type = 'TXT' if domain.verification_method == 'dns_txt' else 'CNAME'

            logger.info(f"[DOMAIN CHECK] Querying DNS: {record_name} ({record_type})")
            
            # Check DNS propagation
            dns_result = verification_service.check_dns_propagation(record_name, record_type)

            logger.debug(f"[DOMAIN CHECK] DNS Result: {dns_result}")

            # Check if verification would succeed
            can_verify = False
            if dns_result.get('success'):
                records = dns_result.get('records', [])
                logger.info(f"[DOMAIN CHECK] Found {len(records)} DNS record(s): {records}")
                
                if domain.verification_method == 'dns_txt':
                    # Check if any record contains our verification value
                    can_verify = any(domain.verification_record_value in record for record in records)
                elif domain.verification_method == 'dns_cname':
                    # Check if CNAME points to our verification domain
                    can_verify = any(domain.verification_record_value in record for record in records)
                
                if can_verify:
                    logger.info(f"[DOMAIN CHECK] ✓ Verification record found and matches!")
                else:
                    logger.warning(f"[DOMAIN CHECK] ✗ Records found but don't match expected value")
            else:
                logger.warning(f"[DOMAIN CHECK] ✗ DNS query failed or no records found")
                logger.warning(f"[DOMAIN CHECK] Error: {dns_result.get('error', 'Unknown error')}")

            return Response({
                "is_verified": False,
                "can_verify": can_verify,
                "dns_records_found": dns_result.get('success', False),
                "verification_details": {
                    "record_name": record_name,
                    "record_type": record_type,
                    "expected_value": domain.verification_record_value,
                    "found_records": dns_result.get('records', []),
                    "dns_check_success": dns_result.get('success', False),
                    "dns_error": dns_result.get('error'),
                },
                "message": "Ready to verify" if can_verify else "DNS records not found or incorrect",
                "domain": CustomDomainSerializer(domain).data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error checking verification for domain {domain.domain}: {str(e)}")
            return Response({
                "is_verified": False,
                "can_verify": False,
                "dns_records_found": False,
                "error": "Failed to check DNS records",
                "domain": CustomDomainSerializer(domain).data
            }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def setup_guide(self, request, pk=None):
        """
        Get detailed setup guide for frontend display
        GET /api/v1/domains/{id}/setup_guide/

        Returns comprehensive setup instructions, DNS examples for popular providers,
        and current verification status
        """
        domain = self.get_object()

        # Check if domain belongs to user's business
        if domain.business != request.user.business:
            return Response(
                {"error": "You don't have permission to view this domain"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Provider-specific instructions
        provider_instructions = {
            "cloudflare": {
                "name": "Cloudflare",
                "steps": [
                    "Log in to Cloudflare dashboard",
                    "Select your domain",
                    "Go to DNS → Records",
                    "Click 'Add record'",
                    f"Set Type: {domain.verification_method.replace('dns_', '').upper()}",
                    f"Set Name: {domain.verification_record_name}",
                    f"Set Content/Value: {domain.verification_record_value}",
                    "Set TTL: Auto or 3600",
                    "Click 'Save'",
                    "Wait 5-30 minutes for propagation"
                ]
            },
            "godaddy": {
                "name": "GoDaddy",
                "steps": [
                    "Log in to GoDaddy account",
                    "Go to My Products → Domain → DNS",
                    f"Click 'Add' → '{domain.verification_method.replace('dns_', '').upper()}'",
                    f"Set Host: {domain.verification_record_name}",
                    f"Set Value: {domain.verification_record_value}",
                    "Set TTL: 1 Hour",
                    "Click 'Save'",
                    "Wait 5-30 minutes for propagation"
                ]
            },
            "namecheap": {
                "name": "Namecheap",
                "steps": [
                    "Log in to Namecheap",
                    "Go to Domain List → Manage → Advanced DNS",
                    "Click 'Add New Record'",
                    f"Set Type: {domain.verification_method.replace('dns_', '').upper()} Record",
                    f"Set Host: {domain.verification_record_name}",
                    f"Set Value: {domain.verification_record_value}",
                    "Set TTL: Automatic",
                    "Click Save",
                    "Wait 5-30 minutes for propagation"
                ]
            },
            "route53": {
                "name": "AWS Route 53",
                "steps": [
                    "Log in to AWS Console",
                    "Go to Route 53 → Hosted Zones",
                    "Select your domain",
                    "Click 'Create Record'",
                    f"Set Record name: {domain.verification_record_name}",
                    f"Set Record type: {domain.verification_method.replace('dns_', '').upper()}",
                    f"Set Value: {domain.verification_record_value}",
                    "Set TTL: 300",
                    "Click 'Create records'",
                    "Wait 5-30 minutes for propagation"
                ]
            },
            "google_domains": {
                "name": "Google Domains",
                "steps": [
                    "Log in to Google Domains",
                    "Select your domain",
                    "Go to DNS settings",
                    "Scroll to Custom records",
                    f"Set Host name: {domain.verification_record_name}",
                    f"Set Type: {domain.verification_method.replace('dns_', '').upper()}",
                    "Set TTL: 3600",
                    f"Set Data: {domain.verification_record_value}",
                    "Click 'Add'",
                    "Wait 5-30 minutes for propagation"
                ]
            }
        }

        # DNS check command examples
        record_type = 'TXT' if domain.verification_method == 'dns_txt' else 'CNAME'
        full_record_name = f"{domain.verification_record_name}.{domain.domain}"

        check_commands = {
            "dig": f"dig {full_record_name} {record_type} +short",
            "nslookup": f"nslookup -type={record_type} {full_record_name}",
            "host": f"host -t {record_type} {full_record_name}",
        }

        online_checkers = [
            {
                "name": "DNS Checker",
                "url": f"https://dnschecker.org/all-dns-records-of-domain.php?query={full_record_name}&rtype={record_type}"
            },
            {
                "name": "What's My DNS",
                "url": f"https://www.whatsmydns.net/#TXT/{full_record_name}"
            },
            {
                "name": "MX Toolbox",
                "url": f"https://mxtoolbox.com/SuperTool.aspx?action=txt:{full_record_name}"
            }
        ]

        return Response({
            "domain": CustomDomainSerializer(domain).data,
            "verification_record": {
                "full_name": full_record_name,
                "name": domain.verification_record_name,
                "type": record_type,
                "value": domain.verification_record_value,
            },
            "provider_instructions": provider_instructions,
            "check_commands": check_commands,
            "online_checkers": online_checkers,
            "estimated_propagation_time": "5-30 minutes (can take up to 48 hours)",
            "next_steps": [
                "Copy the DNS record details above",
                "Log in to your domain provider (DNS management panel)",
                "Add the DNS record as shown in the provider-specific instructions",
                "Wait for DNS propagation (5-30 minutes)",
                "Use 'Check Verification' button to verify DNS is propagated",
                "Click 'Verify Domain' to complete the verification process"
            ]
        }, status=status.HTTP_200_OK)
