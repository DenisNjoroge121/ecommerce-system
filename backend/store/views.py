import uuid
import requests
import base64
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
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Please provide both username and password.'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if not user and '@' in username:
        try:
            matched_user = User.objects.get(email=username)
            user = authenticate(request, username=matched_user.username, password=password)
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            user = None

    if user:
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

    def get_queryset(self):
        queryset = Product.objects.all().order_by('-created_at')

        active_only = self.request.query_params.get('active_only')
        if active_only == 'true' or not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_active=True)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        in_stock = self.request.query_params.get('in_stock')
        if in_stock == 'true':
            queryset = queryset.filter(stock__gt=0)

        ordering = self.request.query_params.get('ordering')
        if ordering in ['price', '-price', 'created_at', '-created_at', 'title']:
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

# -------------------------------------------------------------
# DARAJA M-PESA HELPER FUNCTIONS
# -------------------------------------------------------------

def get_mpesa_access_token():
    consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', None)
    consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', None)
    if not consumer_key or not consumer_secret or consumer_key.startswith('YOUR_'):
        return None
    api_url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    try:
        res = requests.get(api_url, auth=(consumer_key, consumer_secret), timeout=10)
        if res.status_code == 200:
            return res.json().get('access_token')
    except Exception:
        pass
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
# PAYMENT VIEWS: STK PUSH, QUERY STATUS, SIMULATION, RECORDING
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
            res = requests.post(
                "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
                json=payload,
                headers=headers,
                timeout=12
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
                        is_successful=False
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
        except Exception:
            pass

    # Sandbox / Local dev simulation fallback
    simulated_checkout_id = f"ws_CO_{datetime.now().strftime('%d%m%Y%H%M%S')}_{uuid.uuid4().hex[:6]}"
    if order:
        Transaction.objects.create(
            order=order,
            payment_method='mpesa',
            payment_type=payment_type,
            checkout_request_id=simulated_checkout_id,
            amount=Decimal(str(amount_int)),
            phone_number=phone_number,
            is_successful=False
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
    Checks whether the transaction has completed (via webhook, Daraja query, or demo confirmation).
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

    # If already marked successful
    if transaction.is_successful:
        return Response({
            "is_complete": True,
            "status": "completed",
            "receipt_number": transaction.receipt_number,
            "amount_paid": float(transaction.amount),
            "payment_type": transaction.payment_type,
            "phone_number": transaction.phone_number or order.customer_phone,
            "order_status": order.status,
            "order_id": str(order.order_id),
            "total_amount": float(order.total_amount),
            "deposit_amount": float(order.deposit_amount),
            "balance_due": float(order.balance_due),
            "timestamp": transaction.created_at
        })

    # If not yet successful, check with Safaricom Daraja STK Push Query API if live
    access_token = get_mpesa_access_token()
    shortcode = getattr(settings, 'MPESA_SHORTCODE', None)
    passkey = getattr(settings, 'MPESA_PASSKEY', None)

    if access_token and shortcode and passkey and transaction.checkout_request_id and not transaction.checkout_request_id.startswith('ws_CO_'):
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

        try:
            res = requests.post(
                "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
                json=payload,
                headers=headers,
                timeout=8
            )
            data = res.json()
            result_code = data.get('ResultCode')

            if result_code == "0" or result_code == 0:
                receipt = f"REC-MPESA-{uuid.uuid4().hex[:7].upper()}"
                transaction.is_successful = True
                transaction.receipt_number = receipt
                transaction.result_desc = data.get('ResultDesc', 'Payment verified successfully.')
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
                    "amount_paid": float(transaction.amount),
                    "payment_type": transaction.payment_type,
                    "phone_number": transaction.phone_number or order.customer_phone,
                    "order_status": order.status,
                    "order_id": str(order.order_id),
                    "total_amount": float(order.total_amount),
                    "deposit_amount": float(order.deposit_amount),
                    "balance_due": float(order.balance_due),
                    "timestamp": transaction.created_at
                })
            elif result_code and str(result_code) not in ["0", "1032"]:
                # Failed or rejected PIN
                transaction.result_desc = data.get('ResultDesc', 'PIN Entry Failed')
                transaction.save()
                return Response({
                    "is_complete": False,
                    "failed": True,
                    "message": data.get('ResultDesc', 'Transaction could not be completed.')
                })
        except Exception:
            pass

    # Otherwise still pending PIN input
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
def confirm_simulated_payment(request):
    """
    Allows the customer (or admin) to simulate entering the M-Pesa PIN on their phone
    in sandbox / local development mode, immediately confirming the transaction.
    """
    checkout_id = request.data.get('checkout_id')
    order_id = request.data.get('order_id')
    receipt = request.data.get('receipt_number') or f"REC-MPESA-{uuid.uuid4().hex[:7].upper()}"

    transaction = None
    if checkout_id:
        transaction = Transaction.objects.filter(checkout_request_id=checkout_id).order_by('-created_at').first()
    elif order_id:
        transaction = Transaction.objects.filter(order__order_id=order_id).order_by('-created_at').first()

    if not transaction:
        return Response({"error": "No pending transaction found to confirm"}, status=status.HTTP_404_NOT_FOUND)

    order = transaction.order
    transaction.is_successful = True
    transaction.receipt_number = receipt
    transaction.result_desc = "The service request is processed successfully. PIN verified."
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
        "message": "M-Pesa PIN verified. Transaction marked complete!",
        "receipt_number": transaction.receipt_number,
        "amount_paid": float(transaction.amount),
        "deposit_amount": float(order.deposit_amount),
        "balance_due": float(order.balance_due),
        "order_status": order.status,
        "order": OrderSerializer(order).data
    }, status=status.HTTP_200_OK)

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
