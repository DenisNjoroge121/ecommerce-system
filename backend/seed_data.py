import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from store.models import Category, Product

# 1. Create or update admin user
if not User.objects.filter(username='admin').exists():
    admin_user = User.objects.create_superuser('admin', 'admin@devstore.com', 'admin123')
    print("Created superuser admin with password 'admin123'")
else:
    admin_user = User.objects.get(username='admin')
    admin_user.set_password('admin123')
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()
    print("Updated admin user")

# 2. Categories
categories_data = [
    {"name": "Electronics"},
    {"name": "Fashion & Apparel"},
    {"name": "Accessories"},
    {"name": "Home & Office"},
]

category_objs = {}
for c in categories_data:
    cat, _ = Category.objects.get_or_create(name=c["name"])
    category_objs[c["name"]] = cat

print("Created categories:", list(category_objs.keys()))

# 3. Products
products_data = [
    {
        "category": category_objs["Electronics"],
        "title": "Wireless Noise-Cancelling Headphones Pro",
        "description": "High-fidelity audio with active noise cancellation, ambient sound mode, and up to 40 hours of battery life on a single charge.",
        "price": 8500.00,
        "stock": 14,
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Accessories"],
        "title": "Smart Fitness Watch Ultra Edition",
        "description": "Always-on AMOLED display with continuous heart rate monitoring, GPS tracking, sleep metrics, and water resistance up to 50 meters.",
        "price": 6800.00,
        "stock": 8,
        "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Fashion & Apparel"],
        "title": "Vintage Handcrafted Leather Backpack",
        "description": "Genuine top-grain leather designed with padded laptop sleeve for up to 15.6-inch devices, reinforced straps, and antique brass buckles.",
        "price": 4200.00,
        "stock": 12,
        "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Electronics"],
        "title": "Mechanical Wireless Gaming Keyboard RGB",
        "description": "Custom tactile hot-swappable switches, PBT double-shot keycaps, multi-device Bluetooth/2.4GHz connectivity, and customizable per-key RGB backlighting.",
        "price": 5500.00,
        "stock": 6,
        "image": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Home & Office"],
        "title": "Ergonomic Dual-Arm LED Desk Lamp",
        "description": "Modern minimalist desk lamp with adjustable color temperature, brightness slider, auto-dimming ambient sensor, and built-in USB-C charging port.",
        "price": 2900.00,
        "stock": 20,
        "image": "https://images.unsplash.com/photo-1534972195531-a756b1126f24?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Accessories"],
        "title": "Stainless Steel Thermal Tumbler 750ml",
        "description": "Double-wall vacuum insulation keeps cold beverages ice-cold for 24 hours and hot coffee steaming for 12 hours. Sweat-free exterior.",
        "price": 1800.00,
        "stock": 25,
        "image": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Accessories"],
        "title": "Polarized Classic Aviator Sunglasses",
        "description": "UV400 protective polarized lenses in an ultra-lightweight titanium alloy frame. Scratch-resistant coating with luxury case included.",
        "price": 2400.00,
        "stock": 15,
        "image": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80",
    },
    {
        "category": category_objs["Electronics"],
        "title": "Waterproof Portable Bluetooth Speaker",
        "description": "IP67 dust and waterproof rating, 360-degree deep bass stereo sound, and 24-hour non-stop battery life designed for outdoor adventures.",
        "price": 3600.00,
        "stock": 10,
        "image": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80",
    },
]

for p in products_data:
    if not Product.objects.filter(title=p["title"]).exists():
        Product.objects.create(
            category=p["category"],
            title=p["title"],
            description=p["description"],
            price=p["price"],
            stock=p["stock"],
            image=p["image"],
            is_active=True
        )

print("Total products now in database:", Product.objects.count())
