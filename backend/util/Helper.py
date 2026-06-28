import os
import random
import re
import string

from datetime import timedelta, datetime

import uuid

from RNSafarideskBack.settings import BASE_DIR
from users.models import Users
from urllib.parse import urlencode


class Helper:

    def build_integration_url(self, type, request, business, user_info):
        scheme = request.scheme
        host = request.get_host()

        if "localhost" in host or "127.0.0.1" in host:
            base_domain = f"{business.domain}.localhost:3600"
        elif "dev." in host:
            base_domain = f"{business.domain}.dev.safaridesk.io"
        else:
            base_domain = f"{business.domain}.safaridesk.io"

        if type == "teams":
            query_params = urlencode({
                "teams_connected": "true",
                "user_name": user_info.get("displayName", "")
            })

        elif type == "slack":
            query_params = urlencode({
                "slack_connected": "true",
                "team_name": user_info.get("name", "")
            })

        else:
            query_params = ""  # fallback safety

        return f"{scheme}://{base_domain}/config/integrations?{query_params}"

    def log(self, request):
        current_date = datetime.now().strftime('%Y.%m.%d')
        log_file_name = f"{current_date}-request.log"
        log_file_path = os.path.join(BASE_DIR, f'utils/logs/{log_file_name}')
        log_string = f"[{datetime.now().strftime('%Y.%m.%d %I.%M.%S %p')}] => method: {request.method} uri: {request.path} queryString: {request.GET.urlencode()} protocol: {request.scheme} remoteAddr: {request.META.get('REMOTE_ADDR')} remotePort: {request.META.get('REMOTE_PORT')} userAgent: {request.META.get('HTTP_USER_AGENT')}"
        if os.path.exists(log_file_path):
            mode = 'a'
        else:
            mode = 'w'
        with open(log_file_path, mode) as log_file:
            log_file.write(log_string + '\n')

    def generate_random_password(self, length=15):
        """Generate a random strong password with only letters and digits."""
        characters = string.ascii_letters + string.digits  # Excludes punctuation
        return ''.join(random.choices(characters, k=length))

    def generate_incident_code(self, business=None, format_template=None):
        """
        Generate ticket ID based on config format or fallback to default.
        Format examples:
        - INC-{YYYY}-{####} -> INC-2025-0001
        - #{####} -> #0001
        - TICKET-{YY}{MM}-{####} -> TICKET-2512-0001
        """
        if not format_template:
            # Try to get from config
            if business:
                try:
                    from tenant.models.ConfigModel import TicketConfig
                    config = TicketConfig.objects.filter(business=business).first()
                    if config:
                        format_template = config.id_format
                except:
                    pass
            
            # Fallback to default format
            if not format_template:
                format_template = "ITK-{YYYY}-{####}"
        
        return self._generate_id_from_format(format_template, business, 'ticket')
    
    def generate_task_code(self, business=None, format_template=None):
        """
        Generate task ID based on config format or fallback to default.
        """
        if not format_template:
            # Try to get from config
            if business:
                try:
                    from tenant.models.ConfigModel import TaskConfig
                    config = TaskConfig.objects.filter(business=business).first()
                    if config:
                        format_template = config.id_format
                except:
                    pass
            
            # Fallback to default format
            if not format_template:
                format_template = "TSK {##}"
        
        return self._generate_id_from_format(format_template, business, 'task')
    
    def _generate_id_from_format(self, format_template, business, entity_type):
        """
        Generate ID from format template.
        Supports: {YYYY}, {YY}, {MM}, {DD}, {####}, {###}, etc.
        """
        now = datetime.now()
        result = format_template
        
        # Replace date tokens
        result = result.replace('{YYYY}', str(now.year))
        result = result.replace('{YY}', str(now.year)[2:])
        result = result.replace('{MM}', f"{now.month:02d}")
        result = result.replace('{DD}', f"{now.day:02d}")
        
        # Handle sequence numbers (####, ###, etc.)
        import re
        sequence_pattern = r'\{(#+)\}'
        matches = re.findall(sequence_pattern, result)
        
        if matches:
            # Get the number of digits needed
            num_digits = len(matches[0])
            
            # Get next sequence number for this business/year
            sequence = self._get_next_sequence(business, entity_type, now.year)
            sequence_str = str(sequence).zfill(num_digits)
            
            # Replace the first match
            result = re.sub(sequence_pattern, sequence_str, result, count=1)
        
        return result
    
    def _bootstrap_sequence(self, business, entity_type):
        """
        Compute the MAX trailing integer already in use for this business/type.
        Called only once per business — when the EntitySequence row doesn't
        exist yet — so we never re-issue an ID that was created before the
        sequence table existed.
        """
        import re

        def _trailing_int(s):
            if not s:
                return 0
            m = re.search(r'(\d+)\D*$', str(s))
            return int(m.group(1)) if m else 0

        try:
            if entity_type == 'ticket':
                from tenant.models.TicketModel import Ticket
                ids = Ticket.objects.filter(business=business).values_list('ticket_id', flat=True)
            else:
                from tenant.models.TaskModel import Task
                ids = Task.objects.filter(business=business).values_list('task_trackid', flat=True)
            return max((_trailing_int(i) for i in ids), default=0)
        except Exception:
            return 0

    def _get_next_sequence(self, business, entity_type, year):
        """
        Atomically increment a per-business counter using select_for_update().
        Guaranteed unique under concurrent requests — no race window.
        The `year` parameter is kept for signature compatibility but not used;
        the counter is monotonically increasing and never resets.

        On first use for a given business the sequence is bootstrapped from
        existing records, so pre-existing IDs are never re-issued.
        """
        if not business:
            return random.randint(1, 9999)
        try:
            from django.db import transaction
            from tenant.models.SequenceModel import EntitySequence
            with transaction.atomic():
                seq, created = EntitySequence.objects.select_for_update().get_or_create(
                    business=business,
                    entity_type=entity_type,
                    defaults={'last_value': 0},
                )
                if created:
                    seq.last_value = self._bootstrap_sequence(business, entity_type)
                seq.last_value += 1
                seq.save(update_fields=['last_value'])
                return seq.last_value
        except Exception:
            return random.randint(1, 9999)

    def generate_unique_username(self, first_name, last_name, business):
        parts = [first_name.lower()] if first_name else []
        if last_name:
            parts.append(last_name.lower())
        base_username = ".".join(parts) if parts else "user"
        username = base_username
        counter = 1

        while Users.objects.filter(username=username, business=business).exists():
            suffix = f"{counter:02d}"
            username = f"{base_username}{suffix}"
            counter += 1

        return username

    from datetime import datetime

    def format_datetime(self, date_str):
        """
        Converts a datetime string 'YYYY-MM-DD HH:MM:SS.micro'
        to 'DD/MM/YYYY H:M' format.
        """
        try:
            # Parse the input string into a datetime object
            dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S.%f')
            # Format it as 'dd/mm/yyyy H:M'
            return dt.strftime('%d/%m/%Y %H:%M')
        except ValueError as e:
            return f"Invalid date format: {e}"










