"""
setup_admin.py  —  Belo Creations initial setup script
--------------------------------------------------------
Run this ONCE on a fresh deployment to create the superuser account.
All products and categories are managed entirely through Django Admin
at /admin/ — no seed data is added here.

Usage:
    python seed_data.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User

ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_EMAIL    = os.getenv('ADMIN_EMAIL', 'felixmash8@gmail.com')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')

if not User.objects.filter(username=ADMIN_USERNAME).exists():
    User.objects.create_superuser(ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD)
    print(f"✅  Superuser '{ADMIN_USERNAME}' created (email: {ADMIN_EMAIL})")
    print(f"    Password: {ADMIN_PASSWORD}  ← change this after first login!")
else:
    admin = User.objects.get(username=ADMIN_USERNAME)
    admin.email = ADMIN_EMAIL
    admin.is_staff = True
    admin.is_superuser = True
    admin.save()
    print(f"ℹ️   Superuser '{ADMIN_USERNAME}' already exists — email updated to {ADMIN_EMAIL}")

print("\n👉  All products & categories are managed via Django Admin:")
print(f"    /admin/  →  login with '{ADMIN_USERNAME}'")

