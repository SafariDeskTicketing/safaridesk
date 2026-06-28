from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_redis import get_redis_connection
import json
import re
import uuid

from RNSafarideskBack.settings import DOMAIN_NAME
from shared.tasks import send_welcome_message
from users.models import Business, Users
from users.serializers.BusinessRegSerializer import BusinessRegistrationSerializer
from util.Helper import Helper


class BusinessRegistrationView(viewsets.ModelViewSet):
    serializer_class = BusinessRegistrationSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic()
    def create(self, request):
        # Create a new business
        role, _ = Group.objects.get_or_create(name='admin')
        password = Helper().generate_random_password()


        print(request.data)


        if request.data.get("email") and Users.objects.filter(email=request.data.get("email")).exists():
            return Response({"message": "Email already taken"}, status=400)

        if request.data.get("business_name") and Business.objects.filter(name=request.data.get("business_name")).exists():
            return Response({"message": "Business name already exists"}, status=400)

        raw_domain = request.data.get("domain") or ""
        # Sanitize: lowercase, collapse spaces/special chars to hyphens, keep only [a-z0-9-], max 63 chars
        domain = re.sub(r'-{2,}', '-', re.sub(r'[^a-z0-9-]', '-', raw_domain.lower().strip())).strip('-')[:63]

        if not domain:
            return Response({"message": "A valid subdomain is required"}, status=400)

        # Check uniqueness against the sanitized value (what actually gets stored)
        if Business.objects.filter(domain=domain).exists():
            return Response({"message": "Domain already taken"}, status=400)

        user = Users.objects.create(
            first_name=request.data['first_name'],
            last_name=request.data['last_name'],
            username=request.data['email'],
            email=request.data['email'],
            is_superuser=False,
            is_active=True,
            is_staff=True,
            role=role,
            password=make_password(password),
        )

        user.groups.add(role)


        if "localhost" in DOMAIN_NAME:
            domain_url = f"http://{domain}.{DOMAIN_NAME}"
        else:
            domain_url = f"https://{domain}.{DOMAIN_NAME}"

        business = Business.objects.create(
            name=request.data['business_name'],
            organization_size=request.data['organization_size'],
            domain=domain,
            domain_url=domain_url,
            is_active=True,
            website=request.data.get('website') if request.data.get('website') else None,
            owner=user,
            support_url = f"{domain_url}/support" if domain else None,
        )
        # Update user to map it to the business
        user.business = business
        user.save()

        print("Sending password =======> ", password , " to ", user.email)

        send_welcome_message.delay(business.id, user.id, password)

        return Response({
            "message": "Business creation initiated",
            "site_url": domain_url,
            "business_id": business.id,
        }, status=201)
