import hashlib

from django.core.cache import cache


CATALOG_CACHE_TTL = 300
CATALOG_CACHE_VERSION_KEY = 'catalog:version'


def catalog_cache_version():
    version = cache.get(CATALOG_CACHE_VERSION_KEY)
    if version is None:
        cache.add(CATALOG_CACHE_VERSION_KEY, 1, timeout=None)
        version = cache.get(CATALOG_CACHE_VERSION_KEY, 1)
    return version


def category_list_cache_key():
    return f'catalog:categories:v{catalog_cache_version()}'


def product_list_cache_key(request_path):
    path_hash = hashlib.sha256(request_path.encode('utf-8')).hexdigest()
    return f'catalog:products:v{catalog_cache_version()}:{path_hash}'


def staff_product_list_cache_key(request_path):
    path_hash = hashlib.sha256(request_path.encode('utf-8')).hexdigest()
    return f'catalog:staff-products:v{catalog_cache_version()}:{path_hash}'


def invalidate_catalog_cache():
    try:
        cache.incr(CATALOG_CACHE_VERSION_KEY)
    except ValueError:
        cache.set(CATALOG_CACHE_VERSION_KEY, 1, timeout=None)
