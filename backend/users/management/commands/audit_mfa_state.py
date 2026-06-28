from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from users.models import Users


class Command(BaseCommand):
    help = "Audit MFA state and optionally set confirmed affected users to mfa_method='none'."

    def add_arguments(self, parser):
        parser.add_argument(
            '--business-id',
            type=int,
            help='Limit the audit or update to one business ID.',
        )
        parser.add_argument(
            '--set-none',
            nargs='+',
            metavar='EMAIL_OR_USERNAME',
            help='Confirmed users to update to mfa_method=none.',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Required when using --set-none.',
        )

    def handle(self, *args, **options):
        business_id = options.get('business_id')
        identifiers = options.get('set_none') or []
        confirm = options.get('confirm')

        queryset = Users.objects.select_related('business').order_by('business_id', 'email', 'username')
        if business_id:
            queryset = queryset.filter(business_id=business_id)

        if identifiers:
            if not confirm:
                raise CommandError('Use --confirm with --set-none after confirming the affected users.')
            self._set_confirmed_users_to_none(queryset, identifiers)
            return

        suspected_email_mfa = queryset.filter(mfa_method='email')
        broken_totp_mfa = queryset.filter(mfa_method='totp').filter(
            Q(totp_secret__isnull=True) | Q(totp_secret='')
        )

        self.stdout.write('Users with email OTP enabled:')
        self._write_users(suspected_email_mfa)

        self.stdout.write('')
        self.stdout.write('Users with TOTP enabled but no TOTP secret:')
        self._write_users(broken_totp_mfa)

    def _write_users(self, queryset):
        count = queryset.count()
        if count == 0:
            self.stdout.write('  none')
            return

        for user in queryset:
            business = user.business_id or 'none'
            self.stdout.write(
                f'  id={user.id} business_id={business} email={user.email} '
                f'username={user.username} mfa_method={user.mfa_method}'
            )
        self.stdout.write(f'  total={count}')

    def _set_confirmed_users_to_none(self, queryset, identifiers):
        updated = 0
        for identifier in identifiers:
            user = queryset.filter(Q(email__iexact=identifier) | Q(username__iexact=identifier)).first()
            if not user:
                self.stderr.write(f'Not found: {identifier}')
                continue

            previous = user.mfa_method
            user.mfa_method = 'none'
            user.save(update_fields=['mfa_method'])
            updated += 1
            self.stdout.write(
                f'Updated id={user.id} email={user.email} mfa_method={previous}->none'
            )

        self.stdout.write(f'Updated users: {updated}')
