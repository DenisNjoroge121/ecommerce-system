from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, ContactInquiryCreateView, ProductViewSet, OrderViewSet,
    initiate_stk_push, mpesa_callback, process_card_payment,
    register_user, login_user, current_user, change_password
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'orders', OrderViewSet)

urlpatterns = [
    # Auth endpoints
    path('auth/register/', register_user, name='auth-register'),
    path('auth/login/', login_user, name='auth-login'),
    path('auth/me/', current_user, name='auth-me'),
    path('auth/change-password/', change_password, name='auth-change-password'),

    # Payment endpoints
    path('payments/stk-push/', initiate_stk_push, name='payments-stk-push'),
    path('payments/card/', process_card_payment, name='payments-card'),
    path('payments/mpesa/callback/', mpesa_callback, name='payments-mpesa-callback'),

    # Inquiries
    path('contact/', ContactInquiryCreateView.as_view(), name='contact-inquiry'),

    # ViewSet CRUD routes
    path('', include(router.urls)),
]