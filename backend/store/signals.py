from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .cache import invalidate_catalog_cache
from .models import Category, Product


@receiver((post_save, post_delete), sender=Category)
def invalidate_catalog_after_category_change(**kwargs):
    transaction.on_commit(invalidate_catalog_cache)


@receiver((post_save, post_delete), sender=Product)
def invalidate_catalog_after_product_change(**kwargs):
    transaction.on_commit(invalidate_catalog_cache)
