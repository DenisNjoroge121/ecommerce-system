from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Category, ContactInquiry, Product, Order, OrderItem, Transaction

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_superuser']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user

class CategorySerializer(serializers.ModelSerializer):
    products_count = serializers.IntegerField(source='products.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'products_count']
        extra_kwargs = {'slug': {'required': False}}

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'title', 'slug',
            'description', 'price', 'stock', 'image', 'is_active', 'created_at'
        ]
        extra_kwargs = {'slug': {'required': False}}

class OrderItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_image = serializers.SerializerMethodField(read_only=True)
    subtotal = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_title', 'product_image', 'quantity', 'price', 'subtotal']

    def get_product_image(self, obj):
        if obj.product and obj.product.image:
            try:
                return obj.product.image.url
            except Exception:
                return str(obj.product.image)
        return None

    def get_subtotal(self, obj):
        return float(obj.quantity * obj.price)

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            'id', 'payment_method', 'payment_type', 'checkout_request_id',
            'receipt_number', 'amount', 'phone_number', 'result_desc',
            'is_successful', 'created_at'
        ]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, required=False)
    transactions = TransactionSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Order
        fields = [
            'order_id', 'customer_name', 'customer_email', 'customer_phone',
            'total_amount', 'deposit_amount', 'balance_due', 'status',
            'created_at', 'items', 'transactions', 'total_items'
        ]

    def get_total_items(self, obj):
        return sum(item.quantity for item in obj.items.all())

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        total_amount = Decimal(str(validated_data.get('total_amount', 0)))
        
        # When creating a new pending order, deposit collected so far is 0 until payment completes
        validated_data['deposit_amount'] = Decimal('0.00')
        validated_data['balance_due'] = total_amount
        order = Order.objects.create(**validated_data)

        for item in items_data:
            OrderItem.objects.create(order=order, **item)
        return order

class ContactInquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactInquiry
        fields = '__all__'
