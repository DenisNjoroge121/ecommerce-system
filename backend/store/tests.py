import io
from decimal import Decimal
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from .models import Category, Product, Order, OrderItem, Transaction

class CustomerAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser('adminuser', 'admin@example.com', 'adminpass123')
        self.admin_token = Token.objects.create(user=self.admin_user)

    def test_customer_registration_stores_credentials_in_database(self):
        url = reverse('auth-register')
        payload = {
            'username': 'mary_jane',
            'email': 'mary@example.com',
            'password': 'securepassword123',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['user']['username'], 'mary_jane')
        self.assertEqual(res.data['user']['email'], 'mary@example.com')

        # Verify credentials are stored in database
        user = User.objects.filter(username='mary_jane').first()
        self.assertIsNotNone(user, "User was not saved to database")
        self.assertEqual(user.email, 'mary@example.com')
        self.assertTrue(user.check_password('securepassword123'))

    def test_customer_login_by_username_and_email(self):
        # Register a customer
        User.objects.create_user(username='customer1', email='customer1@store.com', password='mypassword123')

        url = reverse('auth-login')

        # Login by exact username
        res1 = self.client.post(url, {'username': 'customer1', 'password': 'mypassword123'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data['user']['username'], 'customer1')

        # Login by email
        res2 = self.client.post(url, {'username': 'customer1@store.com', 'password': 'mypassword123'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['user']['username'], 'customer1')

        # Login with uppercase email / whitespace
        res3 = self.client.post(url, {'username': ' Customer1@store.com ', 'password': 'mypassword123'}, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)

        # Login with case variations in username
        res4 = self.client.post(url, {'username': 'Customer1', 'password': 'mypassword123'}, format='json')
        self.assertEqual(res4.status_code, status.HTTP_200_OK)

    def test_admin_list_customers_endpoint(self):
        # Create 2 customer accounts
        User.objects.create_user('cust_a', 'a@test.com', 'pass123')
        User.objects.create_user('cust_b', 'b@test.com', 'pass123')

        url = reverse('admin-customers')

        # Without auth: 401
        res_anon = self.client.get(url)
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # With admin auth: 200
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        usernames = [c['username'] for c in res_admin.data]
        self.assertIn('cust_a', usernames)
        self.assertIn('cust_b', usernames)


class ProductReferenceAndImageUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='Bags', slug='bags')

    def _generate_test_image(self):
        file = io.BytesIO()
        image = Image.new('RGB', (100, 100), color='purple')
        image.save(file, 'jpeg')
        file.seek(0)
        return SimpleUploadedFile('test_bag.jpg', file.read(), content_type='image/jpeg')

    def test_create_product_with_custom_bag_reference(self):
        url = reverse('product-list')
        payload = {
            'title': 'Red Crochet Shoulder Bag',
            'reference': 'BC-RED-SHL-01',
            'category': self.category.id,
            'price': '3500.00',
            'stock': 8,
            'description': 'Handcrafted crochet shoulder bag in vibrant crimson yarn.',
            'is_active': True,
        }
        res = self.client.post(url, payload, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['reference'], 'BC-RED-SHL-01')

        # Verify DB record
        prod = Product.objects.get(id=res.data['id'])
        self.assertEqual(prod.reference, 'BC-RED-SHL-01')

    def test_create_product_auto_generates_bag_reference_when_blank(self):
        url = reverse('product-list')
        payload = {
            'title': 'Blue Summer Tote Bag',
            'category': self.category.id,
            'price': '2800.00',
            'stock': 5,
            'description': 'Lightweight summer tote bag.',
            'is_active': True,
        }
        res = self.client.post(url, payload, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['reference'].startswith('REF-'))

    def test_upload_image_from_device(self):
        url = reverse('product-list')
        uploaded_image = self._generate_test_image()
        payload = {
            'title': 'Boho Fringe Sling Bag',
            'reference': 'BC-BOHO-SLING-99',
            'category': self.category.id,
            'price': '4200.00',
            'stock': 12,
            'description': 'Bohemian fringe bag with adjustable strap.',
            'image': uploaded_image,
            'is_active': True,
        }
        res = self.client.post(url, payload, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(res.data['image'])
        self.assertIn('test_bag', res.data['image'])

        prod = Product.objects.get(id=res.data['id'])
        self.assertTrue(bool(prod.image))
        self.assertIn('products/test_bag', str(prod.image))

    def test_search_products_by_bag_reference(self):
        Product.objects.create(
            title='Sunset Tote',
            reference='REF-SUNSET-TOTE-77',
            category=self.category,
            price=Decimal('3000.00'),
            stock=10,
            is_active=True,
        )
        url = reverse('product-list')
        res = self.client.get(url, {'search': 'SUNSET-TOTE-77'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['reference'], 'REF-SUNSET-TOTE-77')


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
