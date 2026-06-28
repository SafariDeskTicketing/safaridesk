"""Merge parallel tenant 0057 migrations after the dev branch merge."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        (
            "tenant",
            "0057_ai_usage_accounting",
        ),
        (
            "tenant",
            "0057_rename_copilot_aud_suggesti_311761_idx_copilot_aud_suggest_14ebbd_idx_and_more",
        ),
    ]

    operations = []
