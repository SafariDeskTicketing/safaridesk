# Generated manually on 2026-03-25

from django.conf import settings
from django.db import migrations, models
from django.db.models import F
from django.db.models.functions import Lower, Trim
import django.db.models.deletion


LABEL_COLOR_PALETTE = [
    "#B60205",
    "#D93F0B",
    "#FBCA04",
    "#0E8A16",
    "#1D76DB",
    "#5319E7",
    "#C5DEF5",
    "#FEF2C0",
    "#BFDADC",
    "#D4C5F9",
    "#FFDCE0",
    "#F9D0C4",
]


def pick_label_color(name: str | None) -> str:
    normalized = (name or "").strip().lower()
    if not normalized:
        return LABEL_COLOR_PALETTE[0]

    seed = sum((index + 1) * ord(char) for index, char in enumerate(normalized))
    return LABEL_COLOR_PALETTE[seed % len(LABEL_COLOR_PALETTE)]


def migrate_ticket_tags_to_labels(apps, schema_editor):
    Label = apps.get_model("tenant", "Label")
    Ticket = apps.get_model("tenant", "Ticket")
    db_alias = schema_editor.connection.alias

    queryset = (
        Ticket.objects.using(db_alias)
        .exclude(tags__isnull=True)
        .exclude(tags__exact="")
        .filter(business_id__isnull=False)
    )

    for ticket in queryset.iterator():
        seen = set()
        normalized_names = []
        for raw_name in (ticket.tags or "").split(","):
            cleaned = raw_name.strip()
            if not cleaned:
                continue
            lowered = cleaned.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized_names.append(cleaned)

        if not normalized_names:
            continue

        labels = []
        for name in normalized_names:
            label = (
                Label.objects.using(db_alias)
                .filter(business_id=ticket.business_id, name__iexact=name)
                .first()
            )
            if not label:
                label = Label.objects.using(db_alias).create(
                    name=name,
                    description="Migrated from legacy ticket tags",
                    color=pick_label_color(name),
                    is_active=True,
                    business_id=ticket.business_id,
                )
            labels.append(label)

        ticket.labels.add(*labels)
        ticket.tags = ",".join(label.name for label in labels)
        ticket.save(update_fields=["tags"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tenant", "0046_add_telegram_whatsapp_sources"),
    ]

    operations = [
        migrations.CreateModel(
            name="Label",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("A", "Active"), ("D", "Deactive")], default="A", max_length=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now_add=True)),
                ("date_updated", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=50)),
                ("description", models.TextField(blank=True, default="")),
                ("color", models.CharField(default="#B60205", max_length=7)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "business",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to="users.business"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_%(class)s_objects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_%(class)s_objects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Label",
                "verbose_name_plural": "Labels",
                "db_table": "labels",
                "ordering": ["name", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="label",
            constraint=models.UniqueConstraint(
                F("business"),
                Lower(Trim("name")),
                condition=models.Q(business__isnull=False),
                name="uniq_label_business_name",
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="labels",
            field=models.ManyToManyField(blank=True, related_name="tasks", to="tenant.label"),
        ),
        migrations.AddField(
            model_name="ticket",
            name="labels",
            field=models.ManyToManyField(blank=True, related_name="tickets", to="tenant.label"),
        ),
        migrations.RunPython(migrate_ticket_tags_to_labels, migrations.RunPython.noop),
    ]
