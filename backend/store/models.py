import uuid
from django.db import models
from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Product(models.Model):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or 'product'
            candidate_slug = base_slug
            counter = 1
            while Product.objects.filter(slug=candidate_slug).exclude(pk=self.pk).exists():
                candidate_slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = candidate_slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Payment'),
        ('partially_paid', 'Deposit Paid'),
        ('paid', 'Paid in Full'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )
    order_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=15)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {str(self.order_id)[:8]} - {self.customer_name}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity}x {self.product.title}"

class Transaction(models.Model):
    PAYMENT_METHODS = (('mpesa', 'M-Pesa'), ('card', 'Card'), ('cash', 'Cash'))
    order = models.ForeignKey(Order, related_name='transactions', on_delete=models.CASCADE)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS)
    checkout_request_id = models.CharField(max_length=255, null=True, blank=True)
    receipt_number = models.CharField(max_length=255, null=True, blank=True)
    payment_type = models.CharField(
        max_length=10,
        choices=(('deposit', 'Deposit'), ('final', 'Final Balance'), ('full', 'Full Payment')),
        default='deposit'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    result_desc = models.CharField(max_length=255, null=True, blank=True)
    is_successful = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.payment_method.upper()} - {self.amount} ({'Success' if self.is_successful else 'Pending'})"

class ContactInquiry(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Inquiry from {self.name} ({self.email})"
