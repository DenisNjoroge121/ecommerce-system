import requests
import base64
from datetime import datetime
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Category, Product, Order, Transaction
from .serializers import CategorySerializer, ProductSerializer, OrderSerializer

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer

def get_mpesa_access_token():
    consumer_key = settings.MPESA_CONSUMER_KEY
    consumer_secret = settings.MPESA_CONSUMER_SECRET
    api_url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    res = requests.get(api_url, auth=(consumer_key, consumer_secret))
    return res.json().get('access_token')

@api_view(['POST'])
@permission_classes([AllowAny])
def initiate_stk_push(request):
    phone_number = request.data.get('phone_number')
    order_id = request.data.get('order_id')
    
    try:
        order = Order.objects.get(order_id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    access_token = get_mpesa_access_token()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password_str = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
    password = base64.b64encode(password_str.encode()).decode('utf-8')

    headers = {"Authorization": f"Bearer {access_token}"}
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(order.total_amount),
        "PartyA": phone_number,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone_number,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": str(order.order_id)[:8],
        "TransactionDesc": f"Order Payment"
    }

    res = requests.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", json=payload, headers=headers)
    res_data = res.json()

    if res_data.get('ResponseCode') == '0':
        Transaction.objects.create(
            order=order,
            payment_method='mpesa',
            checkout_request_id=res_data.get('CheckoutRequestID'),
            amount=order.total_amount
        )
        return Response({"status": "STK Push Initiated", "checkout_id": res_data.get('CheckoutRequestID')})
    return Response({"error": "Failed STK Push"}, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def mpesa_callback(request):
    data = request.data
    result_code = data['Body']['stkCallback']['ResultCode']
    checkout_id = data['Body']['stkCallback']['CheckoutRequestID']
    
    try:
        transaction = Transaction.objects.get(checkout_request_id=checkout_id)
        if result_code == 0:
            items = data['Body']['stkCallback']['CallbackMetadata']['Item']
            receipt = next(i['Value'] for i in items if i['Name'] == 'MpesaReceiptNumber')
            transaction.is_successful = True
            transaction.receipt_number = receipt
            transaction.order.status = 'paid'
            transaction.order.save()
        else:
            transaction.order.status = 'failed'
            transaction.order.save()
        transaction.save()
    except Transaction.DoesNotExist:
        pass

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})