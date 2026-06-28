from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from django.contrib.auth.hashers import make_password

from RNSafarideskBack.settings import SUPERUSER_EMAIL, SUPERUSER_FIRST_NAME, SUPERUSER_LAST_NAME, SUPERUSER_USERNAME, \
    SUPERUSER_PHONE_NUMBER, SUPERUSER_PASSWORD, CORE_EMAIL, CORE_FIRST_NAME, CORE_LAST_NAME, CORE_USERNAME, \
    CORE_PHONE_NUMBER, CORE_PASSWORD
from users.models import SuspiciousActivityType, Users, Business
from util.Seeder import SUSPICIOUS_ACTIVITY_TYPES


class Command(BaseCommand):
    help = 'Syncs data for Safari Desk'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting data synchronization...")
        self.create_groups()
        self.createActivies()
        # self.create_overal_user()
        self.create_system_user()
        # superuser = self.create_superuser()
        # self.create_dummy_business(owner=superuser)
        self.stdout.write("Data synchronization complete")

    def createActivies(self):
        for activity_type in SUSPICIOUS_ACTIVITY_TYPES:
            if not SuspiciousActivityType.objects.filter(type_name=activity_type["type_name"]).exists():
                SuspiciousActivityType.objects.create(**activity_type)
                self.stdout.write(self.style.SUCCESS(f'Created activity type: {activity_type["type_name"]}'))

    def create_groups(self):
        """Create default user groups if they do not exist."""
        groups = ['admin', 'agent', 'customer', 'superuser']
        for group_name in groups:
            if not Group.objects.filter(name=group_name).exists():
                Group.objects.create(name=group_name)
                self.stdout.write(f"Group '{group_name}' created.")

    def create_superuser(self):
        """Create a superuser if one does not exist."""
        if not Users.objects.filter(is_superuser=True, email=SUPERUSER_EMAIL).exists():
            self.stdout.write("Creating superuser...")
            role, _ = Group.objects.get_or_create(name='admin')
            superuser = Users.objects.create(
                first_name=SUPERUSER_FIRST_NAME,
                last_name=SUPERUSER_LAST_NAME,
                username=SUPERUSER_EMAIL,
                email=SUPERUSER_EMAIL,
                phone_number=SUPERUSER_PHONE_NUMBER,
                is_superuser=True,
                is_active=True,
                is_staff=True,
                role=role,
                category="CUSTOMER",
                password=make_password(SUPERUSER_PASSWORD),
            )
            superuser.department.set([])
            superuser.groups.add(role)
            self.stdout.write(f"Superuser '{SUPERUSER_USERNAME}' created successfully.")
            return superuser
        self.stdout.write("Superuser already exists.")
        return Users.objects.get(is_superuser=True, email=SUPERUSER_EMAIL)

    def create_dummy_business(self, owner):
        """Create or get a dummy business for the superuser."""
        business, created = Business.objects.get_or_create(
            name="Dummy Business",
            defaults={
                'domain': "zim",
                'is_active': True,
                'website': "https://fluffyfarm.org",
                'domain_url': "https://zim.fluffyfarm.org",
                'owner': owner,
            }
        )

        if created:
            self.stdout.write(f"Business '{business.name}' created.")
        
        if not business.owner:
            business.owner = owner
            business.save()
            
        if not owner.business:
            owner.business = business
            owner.save()
            
        return business

    def create_overal_user(self):
        """Create a superuser if one does not exist."""
        if not Users.objects.filter(is_superuser=True, email=CORE_EMAIL).exists():
            self.stdout.write("Creating core User...")
            role, _ = Group.objects.get_or_create(name='superuser')

            coreUser = Users.objects.create(
                first_name=CORE_FIRST_NAME,
                last_name=CORE_LAST_NAME,
                username=CORE_EMAIL,
                email=CORE_EMAIL,
                phone_number=CORE_PHONE_NUMBER,
                is_superuser=True,
                is_active=True,
                is_staff=True,
                role=role,
                category="BUSINESS",
                password=make_password(CORE_PASSWORD),
            )

            coreUser.groups.add(role)
            self.stdout.write(f"Core user '{CORE_USERNAME}' created successfully.")
            return None
        self.stdout.write("Core user already exists.")
        return None

    def create_login_entity_user(self, user):
        """Create a superuser if one does not exist."""
        if not Users.objects.filter(user_id=user.id).exists():
            self.stdout.write("Creating login user entity ...")
            coreUser = Users.objects.create(
                first_name=user.first_name,
                last_name=user.last_name,
                username=user.username,
                password=make_password(CORE_PASSWORD),
                user_id=user.id,
            )
            self.stdout.write(f"Login Entity created successfully.")
            return None

        self.stdout.write("Entity already exists.")
        return None

    def create_system_user(self):
        if not Users.objects.filter(is_superuser=True, email="system@safaridesk.io").exists():
            self.stdout.write("Creating system user ...")
            role, _ = Group.objects.get_or_create(name='admin')
            superuser = Users.objects.create(
                first_name="System",
                last_name="User",
                username="system@safaridesk.io",
                email="system@safaridesk.io",
                phone_number="254700000000",
                is_superuser=True,
                is_active=False,
                is_staff=True,
                role=role,
                category="SYSTEM",
                password=make_password(SUPERUSER_PASSWORD),
            )
            superuser.department.set([])
            superuser.groups.add(role)
            self.stdout.write(f"System user created successfully.")
            return None
        self.stdout.write("System user already exists.")
        return None
