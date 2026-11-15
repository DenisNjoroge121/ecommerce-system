from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


TOP_LEVEL_CATEGORIES = ('Bags', 'Hats', 'Clothing', 'Accessories')


def create_category_groups(apps, schema_editor):
    Category = apps.get_model('store', 'Category')
    roots = {}
    for name in TOP_LEVEL_CATEGORIES:
        category = Category.objects.filter(name__iexact=name, parent__isnull=True).first()
        if category is None:
            slug = slugify(name)
            if Category.objects.filter(slug=slug).exists():
                slug = f'{slug}-group'
            category = Category.objects.create(name=name, slug=slug)
        else:
            category.name = name
            category.save(update_fields=['name'])
        roots[name] = category

    # Keep existing flat categories as subcategories so products retain their assignment.
    Category.objects.filter(parent__isnull=True).exclude(
        pk__in=[category.pk for category in roots.values()]
    ).update(parent=roots['Bags'])


def reverse_category_groups(apps, schema_editor):
    Category = apps.get_model('store', 'Category')
    Category.objects.filter(parent__isnull=False).update(parent=None)


class Migration(migrations.Migration):
    dependencies = [('store', '0006_product_reference')]

    operations = [
        migrations.AddField(
            model_name='category',
            name='parent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='subcategories', to='store.category'),
        ),
        migrations.AddField(
            model_name='product',
            name='color',
            field=models.CharField(blank=True, db_index=True, default='', max_length=100),
        ),
        migrations.RunPython(create_category_groups, reverse_category_groups),
    ]
