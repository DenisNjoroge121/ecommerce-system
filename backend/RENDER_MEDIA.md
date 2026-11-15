# Keep uploaded product images on Render

Django saves product uploads under `MEDIA_ROOT`. On Render, the default service filesystem is temporary, so files written to the app's local `media` directory can disappear after a restart or deploy. The product database then contains an image filename whose file is gone.

## Configure a persistent disk

For the Django web service in the Render Dashboard:

1. Open **Disks** and attach a persistent disk. Use `/var/data` as its mount path and choose a size that fits the product images.
2. In the service's environment variables, set `MEDIA_ROOT` to `/var/data/media`.
3. Deploy the service. The backend reads `MEDIA_ROOT` from the environment and will store new admin uploads on the mounted disk.

The disk is available on paid Render services. Render disks are attached to one service instance, so the service cannot be scaled to multiple instances while using this local-disk setup. See [Render's persistent disk documentation](https://render.com/docs/disks) for current plan and disk limitations.

## Existing uploads

Attaching a disk does not recover files that Render has already removed. If the old uploads still exist on the running instance, copy them into `/var/data/media` before they are lost. Otherwise, upload those product images again in Django admin after the disk is attached.

For a free Render web service or a deployment that needs multiple instances, store media in an object storage service (for example, S3-compatible storage) instead of the service filesystem.
