from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Update the default task ID format from 'TSK-{YYYY}-{####}' to 'TSK {##}'.
    This is a code-only default change — no database column is altered.
    Existing TaskConfig rows are updated by the management command:
        python manage.py update_task_naming
    """

    dependencies = [
        ('tenant', '0043_csat_question_labels'),
    ]

    operations = [
        migrations.AlterField(
            model_name='taskconfig',
            name='id_format',
            field=models.CharField(
                default='TSK {##}',
                help_text='Task ID format (example: TSK 01, TSK 02). Tokens: {##} = sequence, {YYYY} = year, {MM} = month, {DD} = day',
                max_length=100,
            ),
        ),
    ]
