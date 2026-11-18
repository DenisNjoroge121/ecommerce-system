# Redis-compatible catalog cache

The backend uses `django-redis` when `REDIS_URL` is set. Catalog and category list responses are cached for five minutes. Product or category changes clear the active catalog cache version so shoppers get updated results on the next request. Staff product lists bypass the shared public-product cache.

## Configure Render

1. Create a Render **Key Value** instance in the same region as the Django web service.
2. Copy its internal connection URL into the web service environment as `REDIS_URL`.
3. Redeploy the backend.

Without `REDIS_URL`, Django uses its local in-process cache, so local development does not require Redis. Redis caches API data only; Supabase Storage continues to store and serve product images.
