# Store product images in Cloudflare R2

Product uploads use Django's default file storage. To keep uploads when the app restarts or redeploys, enable Cloudflare R2 storage for the backend.

## Set up the R2 bucket

1. Create an R2 bucket in the Cloudflare dashboard.
2. Create an R2 API token with **Object Read & Write** access to that bucket. Keep its access key and secret private.
3. Enable public access for the bucket. For production, attach a custom domain to the bucket; Cloudflare's `r2.dev` URL is intended for development and is rate limited.
4. Set these environment variables on the Django service:

   ```env
   CLOUDFLARE_R2_ENABLED=true
   CLOUDFLARE_R2_BUCKET=your-bucket-name
   CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
   CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
   CLOUDFLARE_R2_PUBLIC_URL=https://images.example.com
   ```

   Set `CLOUDFLARE_R2_PUBLIC_URL` to the bucket's attached custom domain. For development, it can instead be the full public `https://<bucket>.<account-id>.r2.dev` URL shown in the R2 dashboard.
5. Redeploy the backend. New product images will be uploaded under `products/` in R2, and the product API will return their public image URLs for the storefront to display.

Cloudflare's S3 endpoint format is `https://<account-id>.r2.cloudflarestorage.com`, and the R2 S3 region is `auto`. See the [R2 S3 API setup](https://developers.cloudflare.com/r2/get-started/s3/) and [public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## Existing product images

Enabling R2 changes where Django looks for image files. Existing database records keep their image names, but the old files are not copied automatically. Upload those product images again after enabling R2, or migrate the existing files to the same `products/` keys in the bucket.
