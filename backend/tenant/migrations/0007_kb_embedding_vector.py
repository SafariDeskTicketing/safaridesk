from django.db import migrations


def check_and_setup_vector(apps, schema_editor):
    """
    Attempt to create pgvector extension and vector column/index.
    Skip gracefully if not available - the system will use text search fallback.
    """
    from django.db import connection
    
    # First, check if pgvector extension is available without starting a transaction
    with connection.cursor() as cursor:
        try:
            cursor.execute("""
                SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
            """)
            has_vector = cursor.fetchone() is not None
        except Exception:
            has_vector = False
    
    if not has_vector:
        print("\n" + "=" * 60)
        print("[INFO] pgvector extension not available on this PostgreSQL installation.")
        print("[INFO] Vector search will be disabled. Knowledge base will use text search instead.")
        print("[INFO] To enable vector search, install pgvector: https://github.com/pgvector/pgvector")
        print("=" * 60 + "\n")
        return
    
    # pgvector is available, set it up
    with connection.cursor() as cursor:
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            print("[INFO] pgvector extension enabled.")
            
            # Check if kb_article_embeddings table exists
            cursor.execute("""
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'kb_article_embeddings'
            """)
            if cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE kb_article_embeddings "
                    "ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);"
                )
                print("[INFO] Vector column added to kb_article_embeddings.")
                
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS kb_article_embeddings_vec_cos_idx "
                    "ON kb_article_embeddings USING ivfflat (embedding_vec vector_cosine_ops);"
                )
                print("[INFO] Vector index created.")
        except Exception as e:
            print(f"[WARN] Error setting up vector features: {e}")


class Migration(migrations.Migration):
    dependencies = [
        ("tenant", "0006_chatbot_models"),
    ]

    # This migration is optional - it will skip gracefully if pgvector is not installed
    # The application will fall back to text-based search for knowledge base
    operations = [
        migrations.RunPython(check_and_setup_vector, migrations.RunPython.noop),
    ]
