from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import Category, Product, Order, OrderItem, Transaction

class MPesaPaymentConfirmationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='Electronics', slug='electronics')
        self.product = Product.objects.create(
            category=self.category,
            title='Wireless Headset',
            price=Decimal('2500.00'),
            stock=10
        )
        self.order = Order.objects.create(
            customer_name='Dennis User',
            customer_email='dennis@example.com',
            customer_phone='0712345678',
            total_amount=Decimal('2500.00'),
            deposit_amount=Decimal('0.00'),
            balance_due=Decimal('2500.00'),
            status='pending'
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal('2500.00')
        )
        self.transaction = Transaction.objects.create(
            order=self.order,
            payment_method='mpesa',
            payment_type='deposit',
            checkout_request_id='ws_CO_311020261234567890',
            amount=Decimal('750.00'),
            phone_number='254712345678',
            is_successful=False
        )

    def test_check_payment_status_pending(self):
        url = reverse('payments-status')
        res = self.client.get(url, {'checkout_id': self.transaction.checkout_request_id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data.get('is_complete'))
        self.assertTrue(res.data.get('pending'))

    def test_confirm_payment_with_daraja_transaction_id(self):
        url = reverse('payments-confirm')
        daraja_receipt = 'NLJ7RT61SV'
        payload = {
            'checkout_id': self.transaction.checkout_request_id,
            'transaction_id': daraja_receipt,
            'order_id': str(self.order.order_id)
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('is_complete'))
        self.assertEqual(res.data.get('receipt_number'), daraja_receipt)
        self.assertEqual(res.data.get('transaction_id'), daraja_receipt)

        # Verify DB updates
        self.transaction.refresh_from_db()
        self.order.refresh_from_db()
        self.assertTrue(self.transaction.is_successful)
        self.assertEqual(self.transaction.receipt_number, daraja_receipt)
        self.assertEqual(self.order.deposit_amount, Decimal('750.00'))
        self.assertEqual(self.order.balance_due, Decimal('1750.00'))
        self.assertEqual(self.order.status, 'partially_paid')

    def test_confirm_payment_rejects_duplicate_transaction_id(self):
        # Create an already completed transaction with receipt QK89123456
        Transaction.objects.create(
            order=self.order,
            payment_method='mpesa',
            receipt_number='QK89123456',
            amount=Decimal('500.00'),
            is_successful=True
        )

        url = reverse('payments-confirm')
        payload = {
            'checkout_id': self.transaction.checkout_request_id,
            'transaction_id': 'QK89123456',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been recorded', res.data.get('error', ''))

    def test_confirm_payment_rejects_invalid_transaction_id(self):
        url = reverse('payments-confirm')
        payload = {
            'checkout_id': self.transaction.checkout_request_id,
            'transaction_id': 'NO!',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid M-Pesa Transaction ID', res.data.get('error', ''))

    def test_check_payment_status_when_already_confirmed(self):
        self.transaction.is_successful = True
        self.transaction.receipt_number = 'TAK9876543'
        self.transaction.save()

        url = reverse('payments-status')
        res = self.client.get(url, {'checkout_id': self.transaction.checkout_request_id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('is_complete'))
        self.assertEqual(res.data.get('receipt_number'), 'TAK9876543')
        self.assertEqual(res.data.get('transaction_id'), 'TAK9876543')
