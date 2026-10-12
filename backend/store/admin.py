from django.contrib import admin
from .models import Category, Product, Order, OrderItem, Transaction, ContactInquiry

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'get_product_count')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

    def get_product_count(self, obj):
        return obj.products.count()
    get_product_count.short_description = 'Products Count'

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'price', 'stock', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('title', 'description', 'slug')
    list_editable = ('price', 'stock', 'is_active')
    prepopulated_fields = {'slug': ('title',)}
    ordering = ('-created_at',)

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'price')
    can_delete = False

class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    readonly_fields = ('payment_method', 'checkout_request_id', 'receipt_number', 'amount', 'is_successful', 'created_at')
    can_delete = False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_id', 'customer_name', 'customer_phone', 'customer_email',
        'total_amount', 'status', 'created_at'
    )
    list_filter = ('status', 'created_at')
    search_fields = ('order_id', 'customer_name', 'customer_phone', 'customer_email')
    list_editable = ('status',)
    readonly_fields = ('order_id', 'created_at')
    inlines = [OrderItemInline, TransactionInline]
    ordering = ('-created_at',)

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'product', 'quantity', 'price')
    list_filter = ('product__category',)
    search_fields = ('order__order_id', 'product__title')
    ordering = ('-id',)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'order', 'payment_method', 'amount',
        'receipt_number', 'checkout_request_id', 'is_successful', 'created_at'
    )
    list_filter = ('payment_method', 'is_successful', 'created_at')
    search_fields = ('order__order_id', 'receipt_number', 'checkout_request_id')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

@admin.register(ContactInquiry)
class ContactInquiryAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'created_at', 'short_message')
    search_fields = ('name', 'email', 'message')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

    def short_message(self, obj):
        return (obj.message[:75] + '...') if len(obj.message) > 75 else obj.message
    short_message.short_description = 'Message Preview'
