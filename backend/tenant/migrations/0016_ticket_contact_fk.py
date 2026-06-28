from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0015_contact_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="contact",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tickets",
                to="tenant.contact",
                help_text="Linked contact/customer for this ticket",
            ),
        ),
        migrations.AddIndex(
            model_name="ticket",
            index=models.Index(
                fields=["business", "contact"], name="ticket_business_contact_idx"
            ),
        ),
    ]
