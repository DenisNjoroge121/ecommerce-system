import uuid
import requests
import base64
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q, Sum, Count, Avg
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.authtoken.models import Token

from .models import Category, ContactInquiry, Product, Order, OrderItem, Transaction
from .serializers import (
    CategorySerializer, ContactInquirySerializer, ProductSerializer,
    OrderSerializer, UserSerializer, RegisterSerializer, TransactionSerializer
)

# -------------------------------------------------------------
# AUTHENTICATION VIEWS
# -------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    raw_username = request.data.get('username')
    raw_password = request.data.get('password')

    if not raw_username or not raw_password:
        return Response({'error': 'Please provide both username and password.'}, status=status.HTTP_400_BAD_REQUEST)

    username = str(raw_username).strip()
    password = str(raw_password)

    # 1. Exact username authenticate
    user = authenticate(request, username=username, password=password)

    # 2. Case-insensitive username match
    if not user:
        matched_user = User.objects.filter(username__iexact=username).first()
        if matched_user:
            user = authenticate(request, username=matched_user.username, password=password)

    # 3. Space-normalized username (e.g. "John Doe" -> "John_Doe")
    if not user and ' ' in username:
        norm_username = username.replace(' ', '_')
        matched_user = User.objects.filter(username__iexact=norm_username).first()
        if matched_user:
            user = authenticate(request, username=matched_user.username, password=password)

    # 4. Case-insensitive email match
    if not user:
        matched_user = User.objects.filter(email__iexact=username).first()
        if matched_user:
            user = authenticate(request, username=matched_user.username, password=password)

    if user:
        if not user.is_active:
            return Response({'error': 'This account has been deactivated.'}, status=status.HTTP_403_FORBIDDEN)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })

    return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response(UserSerializer(request.user).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_customers(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Permission denied. Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    customers = User.objects.filter(is_staff=False, is_superuser=False).order_by('-date_joined')
    result = []
    for c in customers:
        user_orders = Order.objects.filter(
            Q(customer_email__iexact=c.email) | Q(customer_name__iexact=c.username)
        )
        total_spent = sum(o.total_amount for o in user_orders)
        result.append({
            'id': c.id,
            'username': c.username,
            'email': c.email,
            'date_joined': c.date_joined,
            'orders_count': user_orders.count(),
            'total_spent': float(total_spent),
        })
    return Response(result)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')

    if not old_password or not new_password:
        return Response({'error': 'Both old password and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 6:
        return Response({'error': 'New password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    if not user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()

    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'status': 'success',
        'message': 'Password changed successfully.',
        'token': token.key
    }, status=status.HTTP_200_OK)

# -------------------------------------------------------------
# PRODUCT & CATEGORY VIEWSETS
# -------------------------------------------------------------

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = Product.objects.all().order_by('-created_at')

        active_only = self.request.query_params.get('active_only')
        if active_only == 'true' or not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search) | Q(reference__icontains=search)
            )

        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        in_stock = self.request.query_params.get('in_stock')
        if in_stock == 'true':
            queryset = queryset.filter(stock__gt=0)

        ordering = self.request.query_params.get('ordering')
        if ordering in ['price', '-price', 'created_at', '-created_at', 'title', 'reference']:
            queryset = queryset.order_by(ordering)

        return queryset

# -------------------------------------------------------------
# ORDER VIEWSET
# -------------------------------------------------------------

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [AllowAny]

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

logger = logging.getLogger(__name__)

# -------------------------------------------------------------
# DARAJA M-PESA HELPER FUNCTIONS
# -------------------------------------------------------------

def get_mpesa_access_token():
    consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', None)
    consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', None)
    if not consumer_key or not consumer_secret or consumer_key.startswith('YOUR_'):
        return None
    mpesa_env = getattr(settings, 'MPESA_ENV', 'sandbox').lower()
    api_url = (
        "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        if mpesa_env == 'production'
        else "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    )
    try:
        res = requests.get(api_url, auth=(consumer_key, consumer_secret), timeout=10)
        if res.status_code == 200:
            return res.json().get('access_token')
        logger.error(f"Failed to fetch M-Pesa token. HTTP {res.status_code}: {res.text}")
    except Exception as e:
        logger.error(f"Exception fetching M-Pesa access token: {e}")
    return None

def normalize_phone(phone_number):
    clean = str(phone_number).strip().replace(' ', '').replace('-', '')
    if clean.startswith('+254'):
        return clean[1:]
    elif clean.startswith('0'):
        return '254' + clean[1:]
    elif not clean.startswith('254') and len(clean) == 9:
        return '254' + clean
    return clean

# -------------------------------------------------------------
# PAYMENT VIEWS: STK PUSH, QUERY STATUS, REAL CONFIRMATION, RECORDING
# -------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def initiate_stk_push(request):
    raw_phone = request.data.get('phone_number', '').strip()
    order_id = request.data.get('order_id')
    custom_amount = request.data.get('amount')
    payment_type = request.data.get('payment_type', 'deposit')  # 'deposit', 'full', 'final'

    phone_number = normalize_phone(raw_phone)
    if not phone_number or len(phone_number) < 10:
        return Response({"error": "Invalid phone number. Kenyan numbers (e.g. 0712345678 or 254712345678) expected."}, status=status.HTTP_400_BAD_REQUEST)

    order = None
    if order_id:
        try:
            order = Order.objects.get(order_id=order_id)
            if custom_amount:
                amount = Decimal(str(custom_amount))
            elif payment_type == 'full':
                amount = order.total_amount
            elif payment_type == 'final':
                amount = order.balance_due if order.balance_due > 0 else order.total_amount
            elif order.deposit_amount and order.deposit_amount > 0:
                amount = order.deposit_amount
            else:
                amount = order.total_amount
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
    elif custom_amount:
        amount = Decimal(str(custom_amount))
    else:
        return Response({"error": "Either order_id or amount must be provided"}, status=status.HTTP_400_BAD_REQUEST)

    amount_int = int(amount)
    if amount_int <= 0:
        amount_int = 1

    access_token = get_mpesa_access_token()
    shortcode = getattr(settings, 'MPESA_SHORTCODE', None) or '174379'
    passkey = getattr(settings, 'MPESA_PASSKEY', None)
    callback_url = getattr(settings, 'MPESA_CALLBACK_URL', 'https://example.com/callback')
    mpesa_env = getattr(settings, 'MPESA_ENV', 'sandbox').lower()

    # Try live Safaricom STK Push if Daraja credentials are configured
    if access_token and shortcode and passkey and not passkey.startswith('YOUR_'):
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password_str = f"{shortcode}{passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode('utf-8')

        headers = {"Authorization": f"Bearer {access_token}"}
        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount_int,
            "PartyA": phone_number,
            "PartyB": shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": str(order.order_id)[:8] if order else "SHOPPING",
            "TransactionDesc": "Payment for Order"
        }

        try:
            stk_url = (
                "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
                if mpesa_env == 'production'
                else "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
            )
            res = requests.post(
                stk_url,
                json=payload,
                headers=headers,
                timeout=15
            )
            res_data = res.json()

            if res_data.get('ResponseCode') == '0':
                checkout_id = res_data.get('CheckoutRequestID')
                if order:
                    Transaction.objects.create(
                        order=order,
                        payment_method='mpesa',
                        payment_type=payment_type,
                        checkout_request_id=checkout_id,
                        amount=Decimal(str(amount_int)),
                        phone_number=phone_number,
                        is_successful=False,
                        result_desc=res_data.get('CustomerMessage', 'STK push dispatched to phone.')
                    )
                return Response({
                    "status": "STK Push Initiated",
                    "checkout_id": checkout_id,
                    "phone_number": phone_number,
                    "amount": amount_int,
                    "payment_type": payment_type,
                    "order_id": str(order.order_id) if order else None,
                    "CustomerMessage": res_data.get('CustomerMessage', 'Please check your phone and enter your M-Pesa PIN.')
                })
            else:
                error_msg = res_data.get('errorMessage') or res_data.get('ResponseDescription') or 'Safaricom STK push failed to initiate.'
                logger.warning(f"Safaricom STK push rejected: {res_data}")
                return Response({"error": error_msg, "details": res_data}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Exception during STK push request: {e}")
            return Response({"error": f"Failed to contact Safaricom Daraja API: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)

    # Sandbox / Local dev fallback when credentials are not configured
    simulated_checkout_id = f"DEV_CO_{datetime.now().strftime('%d%m%Y%H%M%S')}_{uuid.uuid4().hex[:6]}"
    if order:
        Transaction.objects.create(
            order=order,
            payment_method='mpesa',
            payment_type=payment_type,
            checkout_request_id=simulated_checkout_id,
            amount=Decimal(str(amount_int)),
            phone_number=phone_number,
            is_successful=False,
            result_desc="Awaiting payment confirmation."
        )

    return Response({
        "status": "STK Push Initiated",
        "checkout_id": simulated_checkout_id,
        "phone_number": phone_number,
        "amount": amount_int,
        "payment_type": payment_type,
        "order_id": str(order.order_id) if order else None,
        "CustomerMessage": f"STK push prompt sent to {phone_number} for KES {amount_int}. Please enter your M-Pesa PIN on your phone to complete payment."
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def check_payment_status(request):
    """
    Polled by the customer's web page while waiting for M-Pesa PIN entry.
    Checks whether the transaction has completed (via webhook callback, Daraja query, or confirmed transaction ID).
    """
    checkout_id = request.query_params.get('checkout_id')
    order_id = request.query_params.get('order_id')

    transaction = None
    if checkout_id:
        transaction = Transaction.objects.filter(checkout_request_id=checkout_id).order_by('-created_at').first()
    elif order_id:
        transaction = Transaction.objects.filter(order__order_id=order_id).order_by('-created_at').first()

    if not transaction:
        return Response({"error": "Transaction not found"}, status=status.HTTP_404_NOT_FOUND)

    order = transaction.order

    # 1. If already marked successful (via webhook callback or manual confirm with transaction ID)
    if transaction.is_successful:
        return Response({
            "is_complete": True,
            "status": "completed",
            "receipt_number": transaction.receipt_number,
            "transaction_id": transaction.receipt_number,
            "amount_paid": float(transaction.amount),
            "payment_type": transaction.payment_type,
            "phone_number": transaction.phone_number or order.customer_phone,
            "order_status": order.status,
            "order_id": str(order.order_id),
            "total_amount": float(order.total_amount),
            "deposit_amount": float(order.deposit_amount),
            "balance_due": float(order.balance_due),
            "timestamp": transaction.created_at,
            "message": "Payment verified and complete."
        })

    # 2. Query Safaricom Daraja STK Push Query API if credentials and checkout_id exist
    access_token = get_mpesa_access_token()
    shortcode = getattr(settings, 'MPESA_SHORTCODE', None)
    passkey = getattr(settings, 'MPESA_PASSKEY', None)
    mpesa_env = getattr(settings, 'MPESA_ENV', 'sandbox').lower()

    if access_token and shortcode and passkey and transaction.checkout_request_id and not transaction.checkout_request_id.startswith('DEV_CO_'):
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password_str = f"{shortcode}{passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode('utf-8')

        headers = {"Authorization": f"Bearer {access_token}"}
        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": transaction.checkout_request_id
        }

        query_url = (
            "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query"
            if mpesa_env == 'production'
            else "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query"
        )

        try:
            res = requests.post(
                query_url,
                json=payload,
                headers=headers,
                timeout=10
            )

            if res.status_code == 200:
                data = res.json()
                result_code = data.get('ResultCode')

                if result_code == "0" or result_code == 0:
                    # Transaction successfully completed by customer in Daraja!
                    # If callback already gave receipt_number, preserve it; otherwise check data or checkout ID
                    receipt = transaction.receipt_number or data.get('MpesaReceiptNumber') or transaction.checkout_request_id
                    transaction.is_successful = True
                    transaction.receipt_number = receipt
                    transaction.result_desc = data.get('ResultDesc', 'Payment verified successfully by Safaricom Daraja.')
                    transaction.save()

                    # Update order financial balance
                    order.deposit_amount = (order.deposit_amount or Decimal('0.00')) + transaction.amount
                    order.balance_due = max(Decimal('0.00'), order.total_amount - order.deposit_amount)
                    if order.balance_due <= Decimal('0.00'):
                        order.status = 'paid'
                    else:
                        order.status = 'partially_paid'
                    order.save()

                    return Response({
                        "is_complete": True,
                        "status": "completed",
                        "receipt_number": transaction.receipt_number,
                        "transaction_id": transaction.receipt_number,
                        "amount_paid": float(transaction.amount),
                        "payment_type": transaction.payment_type,
                        "phone_number": transaction.phone_number or order.customer_phone,
                        "order_status": order.status,
                        "order_id": str(order.order_id),
                        "total_amount": float(order.total_amount),
                        "deposit_amount": float(order.deposit_amount),
                        "balance_due": float(order.balance_due),
                        "timestamp": transaction.created_at,
                        "message": "Payment confirmed and verified via M-Pesa Daraja!"
                    })
                elif result_code in ["1032", 1032]:
                    # Handset cancellation
                    transaction.result_desc = "Request cancelled by user."
                    transaction.save()
                    return Response({
                        "is_complete": False,
                        "failed": True,
                        "message": "The M-Pesa transaction was cancelled on your phone."
                    })
                elif result_code in ["1037", 1037]:
                    # Timeout waiting for PIN
                    transaction.result_desc = "M-Pesa request timed out."
                    transaction.save()
                    return Response({
                        "is_complete": False,
                        "failed": True,
                        "message": "M-Pesa request timed out waiting for PIN. Please retry."
                    })
                elif result_code is not None and str(result_code) != "":
                    # Failed transaction (wrong PIN, insufficient funds, etc.)
                    transaction.result_desc = data.get('ResultDesc', 'M-Pesa transaction failed.')
                    transaction.save()
                    return Response({
                        "is_complete": False,
                        "failed": True,
                        "message": data.get('ResultDesc', 'Transaction could not be completed.')
                    })
            elif res.status_code == 429:
                # Spike arrest rate limit in Daraja sandbox - treat as still waiting for PIN
                return Response({
                    "is_complete": False,
                    "pending": True,
                    "checkout_id": transaction.checkout_request_id,
                    "order_id": str(order.order_id),
                    "amount": float(transaction.amount),
                    "message": "Checking Safaricom M-Pesa network..."
                })
        except Exception as e:
            logger.warning(f"Exception checking Daraja payment status: {e}")

    # Still waiting for PIN input
    return Response({
        "is_complete": False,
        "pending": True,
        "checkout_id": transaction.checkout_request_id,
        "order_id": str(order.order_id),
        "amount": float(transaction.amount),
        "message": "Waiting for customer to enter M-Pesa PIN on their phone..."
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_payment(request):
    """
    Confirms an M-Pesa payment based on transaction completion and records the transaction
    together with the Daraja M-Pesa Transaction ID (receipt number).
    """
    checkout_id = request.data.get('checkout_id')
    order_id = request.data.get('order_id')
    raw_tx_id = (
        request.data.get('transaction_id') or
        request.data.get('receipt_number') or
        request.data.get('mpesa_receipt_number') or
        request.data.get('mpesa_code')
    )

    transaction = None
    if checkout_id:
        transaction = Transaction.objects.filter(checkout_request_id=checkout_id).order_by('-created_at').first()
    elif order_id:
        transaction = Transaction.objects.filter(order__order_id=order_id).order_by('-created_at').first()

    if not transaction:
        return Response({"error": "No pending payment transaction found to confirm."}, status=status.HTTP_404_NOT_FOUND)

    order = transaction.order

    # If transaction is already successful, return completed details
    if transaction.is_successful:
        return Response({
            "status": "success",
            "is_complete": True,
            "message": "Payment has already been confirmed and recorded.",
            "receipt_number": transaction.receipt_number,
            "transaction_id": transaction.receipt_number,
            "amount_paid": float(transaction.amount),
            "deposit_amount": float(order.deposit_amount),
            "balance_due": float(order.balance_due),
            "order_status": order.status,
            "order": OrderSerializer(order).data
        }, status=status.HTTP_200_OK)

    tx_id = None
    if raw_tx_id:
        tx_id = str(raw_tx_id).strip().upper()
        # M-Pesa transaction IDs are uppercase alphanumeric (e.g. NLJ7RT61SV or SIK8123456)
        if len(tx_id) < 6 or not tx_id.isalnum():
            return Response({
                "error": "Invalid M-Pesa Transaction ID. Expected an alphanumeric code (e.g. NLJ7RT61SV) from your Safaricom SMS."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check for duplicate reuse across other completed orders
        existing = Transaction.objects.filter(
            receipt_number=tx_id,
            is_successful=True
        ).exclude(pk=transaction.pk).first()
        if existing:
            return Response({
                "error": f"M-Pesa Transaction ID '{tx_id}' has already been recorded for another order."
            }, status=status.HTTP_400_BAD_REQUEST)

    # If tx_id wasn't provided, try querying Daraja or checking existing callback receipt
    if not tx_id:
        if transaction.receipt_number:
            tx_id = transaction.receipt_number
        else:
            access_token = get_mpesa_access_token()
            shortcode = getattr(settings, 'MPESA_SHORTCODE', None)
            passkey = getattr(settings, 'MPESA_PASSKEY', None)
            mpesa_env = getattr(settings, 'MPESA_ENV', 'sandbox').lower()

            if access_token and shortcode and passkey and transaction.checkout_request_id and not transaction.checkout_request_id.startswith('DEV_CO_'):
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                password_str = f"{shortcode}{passkey}{timestamp}"
                password = base64.b64encode(password_str.encode()).decode('utf-8')
                headers = {"Authorization": f"Bearer {access_token}"}
                payload = {
                    "BusinessShortCode": shortcode,
                    "Password": password,
                    "Timestamp": timestamp,
                    "CheckoutRequestID": transaction.checkout_request_id
                }
                query_url = (
                    "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query"
                    if mpesa_env == 'production'
                    else "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query"
                )
                try:
                    res = requests.post(query_url, json=payload, headers=headers, timeout=10)
                    if res.status_code == 200:
                        data = res.json()
                        if data.get('ResultCode') in [0, "0"]:
                            tx_id = data.get('MpesaReceiptNumber') or transaction.checkout_request_id
                except Exception as e:
                    logger.warning(f"Error querying Daraja during confirmation: {e}")

    if not tx_id:
        return Response({
            "error": "M-Pesa Transaction ID is required to confirm payment. Please enter the transaction ID from your Safaricom SMS."
        }, status=status.HTTP_400_BAD_REQUEST)

    # Record the transaction together with the Daraja M-Pesa ID
    transaction.is_successful = True
    transaction.receipt_number = tx_id
    transaction.result_desc = f"Payment confirmed with M-Pesa Daraja Transaction ID: {tx_id}"
    transaction.save()

    # Update order financial balance
    order.deposit_amount = (order.deposit_amount or Decimal('0.00')) + transaction.amount
    order.balance_due = max(Decimal('0.00'), order.total_amount - order.deposit_amount)
    if order.balance_due <= Decimal('0.00'):
        order.status = 'paid'
    else:
        order.status = 'partially_paid'
    order.save()

    return Response({
        "status": "success",
        "is_complete": True,
        "message": f"Payment complete! Recorded with M-Pesa Daraja Transaction ID {tx_id}.",
        "receipt_number": transaction.receipt_number,
        "transaction_id": transaction.receipt_number,
        "amount_paid": float(transaction.amount),
        "deposit_amount": float(order.deposit_amount),
        "balance_due": float(order.balance_due),
        "order_status": order.status,
        "order": OrderSerializer(order).data
    }, status=status.HTTP_200_OK)

# Alias for backwards compatibility
confirm_simulated_payment = confirm_payment

@api_view(['POST'])
@permission_classes([AllowAny])
def record_balance_payment(request):
    """
    Admin endpoint to record a balance payment (remaining payment on the bag)
    via M-Pesa, Cash, or Card.
    """
    order_id = request.data.get('order_id')
    amount = request.data.get('amount')
    payment_method = request.data.get('payment_method', 'mpesa')
    receipt_number = request.data.get('receipt_number') or f"BAL-{uuid.uuid4().hex[:7].upper()}"

    if not order_id:
        return Response({"error": "order_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.get(order_id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    pay_amount = Decimal(str(amount)) if amount else order.balance_due
    if pay_amount <= Decimal('0.00'):
        return Response({"error": "This order does not have any remaining balance due."}, status=status.HTTP_400_BAD_REQUEST)

    transaction = Transaction.objects.create(
        order=order,
        payment_method=payment_method,
        payment_type='final',
        receipt_number=receipt_number,
        amount=pay_amount,
        is_successful=True,
        result_desc="Balance settlement recorded."
    )

    order.deposit_amount = (order.deposit_amount or Decimal('0.00')) + pay_amount
    order.balance_due = max(Decimal('0.00'), order.total_amount - order.deposit_amount)
    if order.balance_due <= Decimal('0.00'):
        order.status = 'paid'
    else:
        order.status = 'partially_paid'
    order.save()

    return Response({
        "status": "success",
        "message": f"Balance payment of KES {pay_amount} recorded successfully.",
        "order": OrderSerializer(order).data,
        "transaction": TransactionSerializer(transaction).data
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def mpesa_callback(request):
    data = request.data
    try:
        stk_callback = data.get('Body', {}).get('stkCallback', {})
        result_code = stk_callback.get('ResultCode')
        checkout_id = stk_callback.get('CheckoutRequestID')

        if checkout_id:
            try:
                transaction = Transaction.objects.get(checkout_request_id=checkout_id)
                order = transaction.order
                if result_code == 0:
                    items = stk_callback.get('CallbackMetadata', {}).get('Item', [])
                    receipt = next((i['Value'] for i in items if i.get('Name') == 'MpesaReceiptNumber'), f"REC-MPESA-{uuid.uuid4().hex[:6].upper()}")
                    transaction.is_successful = True
                    transaction.receipt_number = str(receipt)
                    transaction.result_desc = stk_callback.get('ResultDesc', 'Callback payment success.')
                    transaction.save()

                    order.deposit_amount = (order.deposit_amount or Decimal('0.00')) + transaction.amount
                    order.balance_due = max(Decimal('0.00'), order.total_amount - order.deposit_amount)
                    if order.balance_due <= Decimal('0.00'):
                        order.status = 'paid'
                    else:
                        order.status = 'partially_paid'
                    order.save()
                else:
                    transaction.is_successful = False
                    transaction.result_desc = stk_callback.get('ResultDesc', 'Payment cancelled or failed.')
                    transaction.save()
                    if order.deposit_amount <= Decimal('0.00'):
                        order.status = 'failed'
                        order.save()
            except Transaction.DoesNotExist:
                pass
    except Exception:
        pass

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

@api_view(['POST'])
@permission_classes([AllowAny])
def process_card_payment(request):
    order_id = request.data.get('order_id')
    card_number = str(request.data.get('card_number', '')).replace(' ', '').replace('-', '')
    expiry_date = request.data.get('expiry_date', '')
    cvv = request.data.get('cvv', '')
    cardholder_name = request.data.get('cardholder_name', '')
    custom_amount = request.data.get('amount')
    payment_type = request.data.get('payment_type', 'full')

    if not order_id:
        return Response({"error": "order_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.get(order_id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    if len(card_number) < 15 or len(card_number) > 19 or not card_number.isdigit():
        return Response({"error": "Invalid card number format. Must be 15 to 19 digits."}, status=status.HTTP_400_BAD_REQUEST)

    if not cvv or len(str(cvv)) < 3 or len(str(cvv)) > 4:
        return Response({"error": "Invalid CVV security code."}, status=status.HTTP_400_BAD_REQUEST)

    if not expiry_date or '/' not in expiry_date:
        return Response({"error": "Invalid expiration date format (MM/YY expected)."}, status=status.HTTP_400_BAD_REQUEST)

    amount = Decimal(str(custom_amount)) if custom_amount else (order.deposit_amount if payment_type == 'deposit' and order.deposit_amount > 0 else order.total_amount)

    receipt_no = f"REC-CARD-{uuid.uuid4().hex[:8].upper()}"
    transaction = Transaction.objects.create(
        order=order,
        payment_method='card',
        payment_type=payment_type,
        receipt_number=receipt_no,
        amount=amount,
        is_successful=True,
        result_desc="Card transaction authorized successfully."
    )

    order.deposit_amount = (order.deposit_amount or Decimal('0.00')) + amount
    order.balance_due = max(Decimal('0.00'), order.total_amount - order.deposit_amount)
    if order.balance_due <= Decimal('0.00'):
        order.status = 'paid'
    else:
        order.status = 'partially_paid'
    order.save()

    return Response({
        "status": "success",
        "message": "Card payment processed and verified successfully.",
        "receipt_number": receipt_no,
        "order_id": order.order_id,
        "amount": str(amount),
        "deposit_amount": str(order.deposit_amount),
        "balance_due": str(order.balance_due),
        "order_status": order.status,
        "card_last4": card_number[-4:],
        "cardholder_name": cardholder_name or order.customer_name,
        "created_at": transaction.created_at
    }, status=status.HTTP_200_OK)

# -------------------------------------------------------------
# TRADE SUMMARY & CALCULATIONS ANALYTICS (WEEK / MONTH / YEAR)
# -------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def trade_summary_analytics(request):
    """
    Computes summary of trade for the whole week, month, year, or custom range.
    Returns:
    - Gross Trade Volume (Total Bag Values)
    - Total Deposits Collected (Real cash received)
    - Total Outstanding Balance Due (on bags)
    - Total Orders Traded
    - Breakdown by status & timeframe
    """
    period = request.query_params.get('period', 'week')  # 'today', 'week', 'month', 'year', 'all', 'custom'
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')

    now = timezone.now()

    if period == 'today':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now
        period_label = "Today"
    elif period == 'week':
        # Beginning of current week (Monday)
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now
        period_label = f"This Week ({start_date.strftime('%b %d')} - {now.strftime('%b %d, %Y')})"
    elif period == 'month':
        # Beginning of current month
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = now
        period_label = f"This Month ({now.strftime('%B %Y')})"
    elif period == 'year':
        # Beginning of current year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = now
        period_label = f"This Year ({now.strftime('%Y')})"
    elif period == 'custom' and start_date_str and end_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = timezone.make_aware(start_date) if timezone.is_naive(start_date) else start_date

            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
            end_date = timezone.make_aware(end_date) if timezone.is_naive(end_date) else end_date
            period_label = f"Custom Period ({start_date.strftime('%b %d, %Y')} - {end_date.strftime('%b %d, %Y')})"
        except Exception:
            start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            period_label = "This Week"
    else:  # 'all'
        start_date = None
        end_date = None
        period_label = "All Time"

    orders_qs = Order.objects.all()
    transactions_qs = Transaction.objects.filter(is_successful=True)

    if start_date and end_date:
        orders_qs = orders_qs.filter(created_at__gte=start_date, created_at__lte=end_date)
        transactions_qs = transactions_qs.filter(created_at__gte=start_date, created_at__lte=end_date)

    # Core Financial Metrics
    orders_count = orders_qs.count()
    total_trade_volume = orders_qs.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_deposits_collected = transactions_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    total_balance_due = orders_qs.aggregate(total=Sum('balance_due'))['total'] or Decimal('0.00')

    # Status counts
    paid_orders = orders_qs.filter(status='paid').count()
    partial_orders = orders_qs.filter(status='partially_paid').count()
    pending_orders = orders_qs.filter(status='pending').count()
    other_orders = orders_count - (paid_orders + partial_orders + pending_orders)

    # Calculate average bag trade value & settlement rate
    avg_bag_value = (total_trade_volume / orders_count) if orders_count > 0 else Decimal('0.00')
    settlement_rate = (float(total_deposits_collected) / float(total_trade_volume) * 100) if total_trade_volume > 0 else 0.0

    # Payment Methods breakdown
    mpesa_collected = transactions_qs.filter(payment_method='mpesa').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
    card_collected = transactions_qs.filter(payment_method='card').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
    cash_collected = transactions_qs.filter(payment_method='cash').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

    # Timeframe breakdown for visual tables and charts
    breakdown_data = []

    if period == 'week':
        # 7 days of this week (Monday to Sunday)
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        for i in range(7):
            day_dt = week_start + timedelta(days=i)
            day_next = day_dt + timedelta(days=1)
            day_orders = Order.objects.filter(created_at__gte=day_dt, created_at__lt=day_next)
            day_txs = Transaction.objects.filter(is_successful=True, created_at__gte=day_dt, created_at__lt=day_next)

            day_trade = day_orders.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
            day_dep = day_txs.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

            breakdown_data.append({
                'label': f"{days[i]} ({day_dt.strftime('%d %b')})",
                'orders_count': day_orders.count(),
                'trade_volume': float(day_trade),
                'deposits_collected': float(day_dep),
                'balance_due': float(max(Decimal('0.00'), day_trade - day_dep))
            })

    elif period == 'year':
        # 12 months of this year
        year_val = now.year
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for m in range(1, 13):
            m_start = timezone.make_aware(datetime(year_val, m, 1, 0, 0, 0))
            if m == 12:
                m_end = timezone.make_aware(datetime(year_val + 1, 1, 1, 0, 0, 0))
            else:
                m_end = timezone.make_aware(datetime(year_val, m + 1, 1, 0, 0, 0))

            m_orders = Order.objects.filter(created_at__gte=m_start, created_at__lt=m_end)
            m_txs = Transaction.objects.filter(is_successful=True, created_at__gte=m_start, created_at__lt=m_end)

            m_trade = m_orders.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
            m_dep = m_txs.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

            breakdown_data.append({
                'label': months[m - 1],
                'orders_count': m_orders.count(),
                'trade_volume': float(m_trade),
                'deposits_collected': float(m_dep),
                'balance_due': float(max(Decimal('0.00'), m_trade - m_dep))
            })

    elif period == 'month':
        # 4 weeks / weekly buckets of the current month
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        for w in range(4):
            w_start = month_start + timedelta(days=w * 7)
            w_end = month_start + timedelta(days=(w + 1) * 7) if w < 3 else now + timedelta(days=1)

            w_orders = Order.objects.filter(created_at__gte=w_start, created_at__lt=w_end)
            w_txs = Transaction.objects.filter(is_successful=True, created_at__gte=w_start, created_at__lt=w_end)

            w_trade = w_orders.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
            w_dep = w_txs.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

            breakdown_data.append({
                'label': f"Week {w + 1} ({w_start.strftime('%d %b')} - {w_end.strftime('%d %b')})",
                'orders_count': w_orders.count(),
                'trade_volume': float(w_trade),
                'deposits_collected': float(w_dep),
                'balance_due': float(max(Decimal('0.00'), w_trade - w_dep))
            })

    return Response({
        "period": period,
        "period_label": period_label,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "metrics": {
            "total_trade_volume": float(total_trade_volume),
            "total_deposits_collected": float(total_deposits_collected),
            "total_balance_due": float(total_balance_due),
            "settlement_rate": round(settlement_rate, 1),
            "orders_count": orders_count,
            "average_bag_value": float(round(avg_bag_value, 2)),
            "paid_orders": paid_orders,
            "partial_orders": partial_orders,
            "pending_orders": pending_orders,
            "other_orders": other_orders,
        },
        "payment_methods": {
            "mpesa": float(mpesa_collected),
            "card": float(card_collected),
            "cash": float(cash_collected),
        },
        "breakdown": breakdown_data
    })

# -------------------------------------------------------------
# CONTACT INQUIRY
# -------------------------------------------------------------

class ContactInquiryCreateView(generics.CreateAPIView):
    queryset = ContactInquiry.objects.all()
    serializer_class = ContactInquirySerializer
    permission_classes = [AllowAny]


# -------------------------------------------------------------
# RECORD CASH SALE (IN-STORE / WALK-IN POS)
# -------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def record_cash_sale(request):
    """
    Admin endpoint to record a direct in-store cash sale.
    Accepts:
    - customer_name: str (default: 'Walk-in Customer')
    - customer_phone: str (default: '0700000000')
    - customer_email: str (default: 'cash@belocreations.com')
    - items: list of {product_id, quantity, price}
    - amount_paid: float / Decimal (total cash received)
    - receipt_number: str (optional)
    - notes: str (optional)
    """
    data = request.data
    customer_name = str(data.get('customer_name') or 'Walk-in Customer').strip()
    customer_phone = str(data.get('customer_phone') or '0700000000').strip()
    customer_email = str(data.get('customer_email') or 'cash@belocreations.com').strip()
    items_data = data.get('items', [])
    notes = str(data.get('notes') or '').strip()

    if not items_data or not isinstance(items_data, list):
        return Response({'error': 'Please provide at least one product in the items list.'}, status=status.HTTP_400_BAD_REQUEST)

    total_amount = Decimal('0.00')
    resolved_items = []
    for it in items_data:
        p_id = it.get('product_id') or it.get('id')
        qty = int(it.get('quantity', 1))
        if qty <= 0:
            continue
        try:
            product = Product.objects.get(id=p_id)
        except Product.DoesNotExist:
            return Response({'error': f"Product with ID {p_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        unit_price = Decimal(str(it.get('price') or product.price))
        line_total = unit_price * qty
        total_amount += line_total
        resolved_items.append({
            'product': product,
            'quantity': qty,
            'price': unit_price
        })

    if not resolved_items:
        return Response({'error': 'No valid product items provided.'}, status=status.HTTP_400_BAD_REQUEST)

    raw_paid = data.get('amount_paid')
    amount_paid = Decimal(str(raw_paid)) if raw_paid is not None else total_amount
    balance_due = max(Decimal('0.00'), total_amount - amount_paid)
    order_status = 'paid' if balance_due <= Decimal('0.00') else 'partially_paid'

    receipt_number = data.get('receipt_number') or f"CSH-{uuid.uuid4().hex[:7].upper()}"

    # Create Order
    order = Order.objects.create(
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_email=customer_email,
        total_amount=total_amount,
        deposit_amount=amount_paid,
        balance_due=balance_due,
        status=order_status
    )

    # Create OrderItems and decrement stock
    for item in resolved_items:
        OrderItem.objects.create(
            order=order,
            product=item['product'],
            quantity=item['quantity'],
            price=item['price']
        )
        prod = item['product']
        if prod.stock is not None:
            prod.stock = max(0, prod.stock - item['quantity'])
            prod.save(update_fields=['stock'])

    # Create Transaction for the cash payment
    transaction = Transaction.objects.create(
        order=order,
        payment_method='cash',
        payment_type='full' if balance_due <= Decimal('0.00') else 'deposit',
        receipt_number=receipt_number,
        amount=amount_paid,
        is_successful=True,
        phone_number=customer_phone,
        result_desc=f"In-store cash sale. {notes}".strip()
    )

    return Response({
        'status': 'success',
        'message': f"Cash sale of KES {amount_paid:,.2f} recorded successfully (Receipt #{receipt_number}).",
        'order': OrderSerializer(order).data,
        'transaction': TransactionSerializer(transaction).data
    }, status=status.HTTP_201_CREATED)
