import uuid

from django.db import models

# Create your models here.

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default = 0)
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('shipped', 'Shipped'),
        ('failed', 'Failed'),
    ]
    order_id = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)


class Transaction(models.Model):
    PAYMENT_METHODS = (('mpesa', 'M-Pesa'), ('card', 'Card'))
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='transactions')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    checkout_request_id = models.CharField(max_length=100, null=True, blank=True)
    receipt_number = models.CharField(max_length=255, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    is_successful = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)