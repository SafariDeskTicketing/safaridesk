from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tenant", "0067_exportjob"),
    ]

    operations = [
        migrations.CreateModel(
            name="TicketCallLog",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("A", "ACTIVE"), ("I", "INACTIVE"), ("S", "Suspended"), ("D", "DEACTIVATED"), ("L", "LOCKED"), ("B", "BLOCKED")], default="A", max_length=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now_add=True)),
                ("date_updated", models.DateTimeField(auto_now=True)),
                ("subject", models.CharField(max_length=200)),
                ("content", models.TextField()),
                ("contact_name", models.CharField(blank=True, max_length=200)),
                ("contact_email", models.EmailField(blank=True, max_length=254)),
                ("duration", models.CharField(blank=True, max_length=50)),
                ("is_internal", models.BooleanField(default=True)),
                ("business", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to="users.business")),
                ("contact", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ticket_call_logs", to="tenant.contact")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_ticketcalllog_objects", to=settings.AUTH_USER_MODEL)),
                ("logged_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ticket_call_logs", to=settings.AUTH_USER_MODEL)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="call_logs", to="tenant.ticket")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_ticketcalllog_objects", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Ticket Call Log",
                "verbose_name_plural": "Ticket Call Logs",
                "db_table": "ticket_call_logs",
                "ordering": ["created_at"],
            },
        ),
        migrations.AlterField(
            model_name="copilotprompttemplate",
            name="command",
            field=models.CharField(choices=[("summarize", "Summarize"), ("draft-reply", "Draft Reply"), ("draft-note", "Draft Note"), ("draft-call-log", "Draft Call Log"), ("similar", "Similar"), ("suggest-kb", "Suggest KB"), ("triage", "Triage")], db_index=True, max_length=32),
        ),
        migrations.AlterField(
            model_name="ticketactivity",
            name="activity_type",
            field=models.CharField(choices=[("created", "Ticket Created"), ("updated", "Ticket Updated"), ("commented", "Comment Added"), ("assigned", "Ticket Assigned"), ("status_changed", "Status Changed"), ("priority_changed", "Priority Changed"), ("attachment_added", "Attachment Added"), ("resolved", "Ticket Resolved"), ("closed", "Ticket Closed"), ("task_linked", "Task Linked"), ("label_added", "Label Added"), ("label_removed", "Label Removed"), ("call_logged", "Call Logged")], max_length=20),
        ),
        migrations.AddIndex(
            model_name="ticketcalllog",
            index=models.Index(fields=["business", "ticket", "created_at"], name="ticket_call_busines_1d3c5e_idx"),
        ),
        migrations.AddIndex(
            model_name="ticketcalllog",
            index=models.Index(fields=["logged_by"], name="ticket_call_logged_9cc62f_idx"),
        ),
        migrations.AddIndex(
            model_name="ticketcalllog",
            index=models.Index(fields=["contact"], name="ticket_call_contact_59f3ec_idx"),
        ),
    ]
