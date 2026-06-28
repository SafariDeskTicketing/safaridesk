#!/usr/bin/env python3
import os
import sys
# Ensure working directory is project root so Django package imports resolve
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'RNSafarideskBack.settings')
import django
django.setup()

from shared.management.commands import verify_notifications as verifier

if __name__ == '__main__':
    exit_code = verifier.run_verification()
    sys.exit(exit_code)
