from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0048_merge_0047_email_filter_models_0047_shared_labels'),
        ('users', '0009_failedloginattempt'),
    ]

    operations = [
        migrations.CreateModel(
            name='EntitySequence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entity_type', models.CharField(max_length=20)),
                ('last_value', models.PositiveIntegerField(default=0)),
                ('business', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sequences',
                    to='users.business',
                )),
            ],
            options={
                'verbose_name': 'Entity Sequence',
                'db_table': 'entity_sequences',
                'unique_together': {('business', 'entity_type')},
            },
        ),
    ]
