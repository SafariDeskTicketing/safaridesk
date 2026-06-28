from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Install pgvector extension in PostgreSQL database'

    def handle(self, *args, **options):
        self.stdout.write("Installing pgvector extension...")
        
        try:
            with connection.cursor() as cursor:
                # Check if extension already exists
                cursor.execute("""
                    SELECT EXISTS(
                        SELECT 1 FROM pg_extension WHERE extname = 'vector'
                    );
                """)
                exists = cursor.fetchone()[0]
                
                if exists:
                    self.stdout.write(
                        self.style.WARNING("pgvector extension already exists. Skipping installation.")
                    )
                else:
                    # Install pgvector extension
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                    self.stdout.write(
                        self.style.SUCCESS("Successfully installed pgvector extension")
                    )
                    
                    # Verify installation
                    cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
                    version = cursor.fetchone()
                    if version:
                        self.stdout.write(
                            self.style.SUCCESS(f"pgvector version: {version[0]}")
                        )
                        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error installing pgvector extension: {str(e)}")
            )
            raise




