# Redis-compatible catalog cache

The backend uses `django-redis` when `REDIS_URL` is set. Catalog and category list responses are cached for five minutes. The admin product list has its own cache namespace, separate from the public catalog, so it can include inactive products safely. Product or category changes invalidate both catalog namespaces so updated data appears on the next request.

Orders, payment state, analytics, and customer records are not cached; the admin dashboard continues to receive fresh operational data.

## Configure Render

1. Create a Render **Key Value** instance in the same region as the Django web service.
2. Copy its internal connection URL into the web service environment as `REDIS_URL`.
3. Redeploy the backend.

Without `REDIS_URL`, Django uses its local in-process cache, so local development does not require Redis. Redis caches API data only; Supabase Storage continues to store and serve product images.
