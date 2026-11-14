from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Product, Order, OrderItem, Transaction, ContactInquiry


# ─────────────────────────────────────────────────────────────
#  SITE BRANDING
# ─────────────────────────────────────────────────────────────
admin.site.site_header  = "Belo Creations Admin"
admin.site.site_title   = "Belo Creations"
admin.site.index_title  = "Store Management"


# ─────────────────────────────────────────────────────────────
#  CATEGORY
# ─────────────────────────────────────────────────────────────
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'slug', 'get_product_count')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()
    get_product_count.short_description = 'Active Products'


# ─────────────────────────────────────────────────────────────
#  PRODUCT
# ─────────────────────────────────────────────────────────────
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display   = (
        'image_preview', 'title', 'reference', 'category',
        'price', 'stock', 'is_active', 'created_at'
    )
    list_display_links = ('image_preview', 'title')
    list_filter    = ('category', 'is_active', 'created_at')
    search_fields  = ('title', 'reference', 'description')
    list_editable  = ('price', 'stock', 'is_active')
    prepopulated_fields = {'slug': ('title',)}
    ordering       = ('-created_at',)
    readonly_fields = ('reference', 'slug', 'created_at', 'image_preview_large')

    fieldsets = (
        ('Product Info', {
            'fields': ('title', 'reference', 'slug', 'category', 'description')
        }),
        ('Pricing & Stock', {
            'fields': ('price', 'stock', 'is_active')
        }),
        ('Product Image', {
            'fields': ('image', 'image_preview_large'),
            'description': 'Upload a clear photo of the handbag. Supported: JPG, PNG, WEBP.'
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    def image_preview(self, obj):
        if obj.image:
            url = obj.image.url if hasattr(obj.image, 'url') else str(obj.image)
            return format_html(
                '<img src="{}" style="width:50px;height:50px;object-fit:cover;'
                'border-radius:6px;border:1px solid #ddd;" />',
                url
            )
        return format_html('<span style="color:#aaa;font-size:11px;">No image</span>')
    image_preview.short_description = 'Photo'

    def image_preview_large(self, obj):
        if obj.image:
            url = obj.image.url if hasattr(obj.image, 'url') else str(obj.image)
            return format_html(
                '<img src="{}" style="max-width:300px;max-height:300px;'
                'object-fit:contain;border-radius:8px;border:1px solid #ddd;" />',
                url
            )
        return "No image uploaded yet."
    image_preview_large.short_description = 'Current Image'

    # Bulk actions
    actions = ['mark_active', 'mark_inactive', 'restock_zero']

    def mark_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} product(s) set to Active.")
    mark_active.short_description = "✅ Mark selected as Active"

    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} product(s) set to Inactive.")
    mark_inactive.short_description = "🚫 Mark selected as Inactive"

    def restock_zero(self, request, queryset):
        updated = queryset.filter(stock=0).update(is_active=False)
        self.message_user(request, f"{updated} out-of-stock product(s) hidden.")
    restock_zero.short_description = "🔴 Hide out-of-stock products"


# ─────────────────────────────────────────────────────────────
#  ORDER
# ─────────────────────────────────────────────────────────────
class OrderItemInline(admin.TabularInline):
    model  = OrderItem
    extra  = 0
    readonly_fields = ('product', 'quantity', 'price')
    can_delete = False

class TransactionInline(admin.TabularInline):
    model  = Transaction
    extra  = 0
    readonly_fields = (
        'payment_method', 'payment_type', 'checkout_request_id',
        'receipt_number', 'amount', 'phone_number', 'is_successful', 'created_at'
    )
    can_delete = False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_id', 'customer_name', 'customer_phone',
        'total_amount', 'deposit_amount', 'balance_due',
        'status_badge', 'created_at'
    )
    list_filter    = ('status', 'created_at')
    search_fields  = ('order_id', 'customer_name', 'customer_phone', 'customer_email')
    list_editable  = ()
    readonly_fields = ('order_id', 'created_at')
    inlines        = [OrderItemInline, TransactionInline]
    ordering       = ('-created_at',)

    STATUS_COLORS = {
        'pending':        '#f59e0b',
        'partially_paid': '#3b82f6',
        'paid':           '#10b981',
        'shipped':        '#6366f1',
        'delivered':      '#059669',
        'failed':         '#ef4444',
        'cancelled':      '#6b7280',
    }

    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, '#888')
        label = obj.get_status_display()
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 10px;'
            'border-radius:12px;font-size:11px;font-weight:600;">{}</span>',
            color, label
        )
    status_badge.short_description = 'Status'

    actions = ['mark_delivered', 'mark_shipped', 'mark_cancelled']

    def mark_delivered(self, request, queryset):
        queryset.update(status='delivered')
        self.message_user(request, "Selected orders marked as Delivered.")
    mark_delivered.short_description = "✅ Mark as Delivered"

    def mark_shipped(self, request, queryset):
        queryset.update(status='shipped')
        self.message_user(request, "Selected orders marked as Shipped.")
    mark_shipped.short_description = "📦 Mark as Shipped"

    def mark_cancelled(self, request, queryset):
        queryset.update(status='cancelled')
        self.message_user(request, "Selected orders marked as Cancelled.")
    mark_cancelled.short_description = "❌ Mark as Cancelled"


# ─────────────────────────────────────────────────────────────
#  TRANSACTION
# ─────────────────────────────────────────────────────────────
@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'order', 'payment_method', 'payment_type',
        'amount', 'receipt_number', 'is_successful', 'created_at'
    )
    list_filter   = ('payment_method', 'payment_type', 'is_successful', 'created_at')
    search_fields = ('order__order_id', 'receipt_number', 'checkout_request_id', 'phone_number')
    readonly_fields = ('created_at',)
    ordering      = ('-created_at',)


# ─────────────────────────────────────────────────────────────
#  CONTACT INQUIRY
# ─────────────────────────────────────────────────────────────
@admin.register(ContactInquiry)
class ContactInquiryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'email', 'created_at', 'short_message')
    search_fields = ('name', 'email', 'message')
    readonly_fields = ('name', 'email', 'message', 'created_at')
    ordering      = ('-created_at',)

    def short_message(self, obj):
        return (obj.message[:80] + '…') if len(obj.message) > 80 else obj.message
    short_message.short_description = 'Message Preview'

    def has_add_permission(self, request):
        return False  # inquiries only come from customers

