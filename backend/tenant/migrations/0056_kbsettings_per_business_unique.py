# Fix KBSettings uniqueness for multi-tenancy.
#
# Before this migration, `KBSettings.key` had a global `unique=True`, which
# meant only one business could own a setting with a given key. That broke
# every tenant except the first one that saved a setting. This migration
# removes the global unique and replaces it with a composite unique on
# (key, business), plus an index to keep lookups fast.
#
# It also dedupes any pre-existing rows that share a key across businesses,
# keeping the most recently updated row per (key, business) pair so we don't
# crash on the new unique constraint.

from django.db import migrations, models


def dedupe_settings(apps, schema_editor):
    """Collapse duplicates so the new unique constraint can apply cleanly."""
    KBSettings = apps.get_model("tenant", "KBSettings")
    seen = {}
    to_delete = []
    # Order by date_updated DESC so the newest row wins the (key, business) slot.
    for row in KBSettings.objects.order_by("-date_updated", "-id").values("id", "key", "business_id", "date_updated"):
        bucket = (row["key"], row["business_id"])
        if bucket in seen:
            to_delete.append(row["id"])
        else:
            seen[bucket] = row["id"]
    if to_delete:
        KBSettings.objects.filter(id__in=to_delete).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0055_kb_ai_suggestions"),
    ]

    operations = [
        migrations.RunPython(dedupe_settings, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="kbsettings",
            name="key",
            field=models.CharField(db_index=True, max_length=100),
        ),
        migrations.AlterUniqueTogether(
            name="kbsettings",
            unique_together={("key", "business")},
        ),
        migrations.AddIndex(
            model_name="kbsettings",
            index=models.Index(fields=["key", "business"], name="kb_settings_key_biz_idx"),
        ),
    ]
