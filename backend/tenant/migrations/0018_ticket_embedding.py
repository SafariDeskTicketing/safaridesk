from django.db import migrations, models
from django.conf import settings
import django.db.models.deletion


def setup_ticket_embedding_vector(apps, schema_editor):
    from django.db import connection

    with connection.cursor() as cursor:
        try:
            cursor.execute("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
            has_vector = cursor.fetchone() is not None
        except Exception:
            has_vector = False

    if not has_vector:
        print("[INFO] pgvector extension not available. Ticket duplicate detection will use fallback scoring.")
        return

    with connection.cursor() as cursor:
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            cursor.execute(
                "ALTER TABLE ticket_embeddings "
                "ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS ticket_embeddings_vec_cos_idx "
                "ON ticket_embeddings USING ivfflat (embedding_vec vector_cosine_ops);"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS ticket_embeddings_business_ticket_idx "
                "ON ticket_embeddings (business_id, ticket_id);"
            )
        except Exception as exc:
            print(f"[WARN] Error setting up ticket vector features: {exc}")


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0017_alter_kbarticleembedding_embedding_model'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketEmbedding',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('A', 'ACTIVE'), ('I', 'INACTIVE'), ('S', 'Suspended'), ('D', 'DEACTIVATED'), ('L', 'LOCKED'), ('B', 'BLOCKED')], default='A', max_length=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now_add=True)),
                ('date_updated', models.DateTimeField(auto_now=True)),
                ('embedding', models.JSONField(help_text='Vector embedding stored as array [dim1, dim2, ...]')),
                ('embedding_model', models.CharField(default='gemini-embedding-001', max_length=100)),
                ('embedding_version', models.CharField(blank=True, max_length=50)),
                ('generated_at', models.DateTimeField(auto_now=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='users.business')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_%(class)s_objects', to=settings.AUTH_USER_MODEL)),
                ('ticket', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='embedding', to='tenant.ticket')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_%(class)s_objects', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Ticket Embedding',
                'verbose_name_plural': 'Ticket Embeddings',
                'db_table': 'ticket_embeddings',
            },
        ),
        migrations.AddIndex(
            model_name='ticketembedding',
            index=models.Index(fields=['business', 'ticket'], name='ticket_embe_busines_1699fd_idx'),
        ),
        migrations.RunPython(setup_ticket_embedding_vector, migrations.RunPython.noop),
    ]
