from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0016_ticket_contact_fk'),
    ]

    operations = [
        migrations.AlterField(
            model_name='kbarticleembedding',
            name='embedding_model',
            field=models.CharField(default='gemini-embedding-001', max_length=100),
        ),
    ]
