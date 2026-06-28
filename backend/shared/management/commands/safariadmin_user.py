from __future__ import annotations

from getpass import getpass
from typing import Any

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from users.models import Users


class Command(BaseCommand):
    help = "Create, inspect, or recover a SafariAdmin-capable user."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--email", required=True, help="Email address for the SafariAdmin user.")
        parser.add_argument("--username", default="", help="Username for new users. Defaults to email.")
        parser.add_argument("--password", default="", help="Password to set. Omit to prompt securely.")
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reset password and restore SafariAdmin access flags for an existing user.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        email = str(options["email"]).strip().lower()
        username = str(options.get("username") or email).strip()
        raw_password = str(options.get("password") or "")
        reset_password = bool(options.get("reset_password"))

        if not email:
            raise CommandError("--email is required.")
        if not username:
            raise CommandError("--username cannot be blank.")

        user = Users.objects.filter(email__iexact=email).first()
        if not user and username:
            user = Users.objects.filter(username__iexact=username).first()

        if user and not reset_password:
            self._print_user(user, created=False)
            self.stdout.write(self.style.WARNING("User already exists. No changes were made."))
            return

        if not raw_password:
            raw_password = getpass("SafariAdmin password: ")
        if not raw_password:
            raise CommandError("Password cannot be blank.")

        role, _ = Group.objects.get_or_create(name="admin")

        with transaction.atomic():
            if user:
                user.set_password(raw_password)
                user.role = role
                user.is_staff = True
                user.is_superuser = True
                user.is_active = True
                user.status = "A"
                user.category = "BUSINESS"
                user.save(
                    update_fields=[
                        "password",
                        "role",
                        "is_staff",
                        "is_superuser",
                        "is_active",
                        "status",
                        "category",
                    ]
                )
                user.groups.add(role)
                self._print_user(user, created=False)
                self.stdout.write(self.style.SUCCESS("SafariAdmin user recovered and password reset."))
                return

            user = Users(
                email=email,
                username=username,
                role=role,
                is_staff=True,
                is_superuser=True,
                is_active=True,
                status="A",
                category="BUSINESS",
            )
            user.set_password(raw_password)
            user.save()
            user.groups.add(role)

        self._print_user(user, created=True)
        self.stdout.write(self.style.SUCCESS("SafariAdmin user created."))

    def _print_user(self, user: Users, *, created: bool) -> None:
        self.stdout.write("SafariAdmin user:")
        self.stdout.write(f"  created_now: {created}")
        self.stdout.write(f"  id: {user.id}")
        self.stdout.write(f"  email: {user.email}")
        self.stdout.write(f"  username: {user.username}")
        self.stdout.write(f"  is_staff: {user.is_staff}")
        self.stdout.write(f"  is_superuser: {user.is_superuser}")
        self.stdout.write(f"  is_active: {user.is_active}")
        self.stdout.write(f"  status: {user.status}")
        self.stdout.write(f"  category: {user.category}")
        self.stdout.write(f"  role: {user.role.name if user.role else ''}")
        self.stdout.write(f"  business_id: {user.business_id or ''}")
