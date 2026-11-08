import re
from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Category, ContactInquiry, Product, Order, OrderItem, Transaction

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_superuser', 'date_joined']

class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def validate_username(self, value):
        clean_value = re.sub(r'\s+', '_', value.strip())
        if not clean_value:
            raise serializers.ValidationError("Username cannot be empty.")
        if User.objects.filter(username__iexact=clean_value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return clean_value

    def validate_email(self, value):
        clean_email = value.strip().lower()
        if not clean_email:
            raise serializers.ValidationError("Email address is required.")
        if User.objects.filter(email__iexact=clean_email).exists():
            raise serializers.ValidationError("An account with this email already exists. Please sign in.")
        return clean_email

    def create(self, validated_data):
        username = validated_data['username']
        email = validated_data['email']
        password = validated_data['password']
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
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
    image_url = serializers.CharField(write_only=True, required=False, allow_blank=True)
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'title', 'reference', 'slug',
            'description', 'price', 'stock', 'image', 'image_url', 'is_active', 'created_at'
        ]
        extra_kwargs = {
            'slug': {'required': False},
            'reference': {'required': False, 'allow_blank': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        image_val = instance.image
        if image_val:
            image_str = str(image_val)
            if image_str.startswith('http://') or image_str.startswith('https://'):
                data['image'] = image_str
            else:
                request = self.context.get('request')
                if request:
                    data['image'] = request.build_absolute_uri(image_val.url)
                else:
                    data['image'] = image_val.url
        return data

    def create(self, validated_data):
        image_url = validated_data.pop('image_url', None)
        if not validated_data.get('image') and image_url:
            validated_data['image'] = image_url
        return super().create(validated_data)

    def update(self, instance, validated_data):
        image_url = validated_data.pop('image_url', None)
        if not validated_data.get('image') and image_url:
            validated_data['image'] = image_url
        return super().update(instance, validated_data)

class OrderItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_reference = serializers.CharField(source='product.reference', read_only=True)
    product_image = serializers.SerializerMethodField(read_only=True)
    subtotal = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_title', 'product_reference', 'product_image', 'quantity', 'price', 'subtotal']

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
