import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import API from '../api';
import { ShoppingBag, ArrowLeft, Trash2, Smartphone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function Checkout() {
  const { cart, removeFromCart, clearCart, getTotal } = useCartStore();
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);

  const totalAmount = getTotal();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Create order in Django backend
      const orderPayload = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        total_amount: Number(totalAmount).toFixed(2),
        status: 'pending',
        items: cart.map((item) => ({
          product: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      const orderRes = await API.post('orders/', orderPayload);
      const createdOrder = orderRes.data;

      // 2. Format Kenyan phone number for M-Pesa STK push (e.g. 2547XXXXXXXX)
      let phone = formData.customer_phone.trim().replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) {
        phone = '254' + phone.slice(1);
      } else if (phone.startsWith('+254')) {
        phone = phone.slice(1);
      } else if (!phone.startsWith('254') && phone.length === 9) {
        phone = '254' + phone;
      }

      // 3. Initiate STK Push
      let stkData = null;
      try {
        const stkRes = await API.post('payments/stk-push/', {
          phone_number: phone,
          order_id: createdOrder.order_id,
        });
        stkData = stkRes.data;
      } catch (stkErr) {
        console.warn('STK push prompt failed or running in test mode:', stkErr);
      }

      setOrderSuccess({
        order: createdOrder,
        stk: stkData,
      });

      clearCart();
    } catch (err) {
      console.error('Order creation failed:', err);
      setErrorMsg(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to process order. Please verify your details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Order Placed Successfully!</h1>
            <p className="text-sm text-gray-500">
              Order Reference:{' '}
              <span className="font-mono font-semibold text-slate-800">
                {orderSuccess.order?.order_id?.slice(0, 8)}
              </span>
            </p>
          </div>

          <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-left text-sm text-sky-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <Smartphone className="w-5 h-5 text-sky-600" />
              <span>M-Pesa STK Prompt Sent</span>
            </div>
            <p className="text-xs text-sky-700 leading-relaxed">
              Please check your phone (<strong>{formData.customer_phone}</strong>) for the M-Pesa PIN prompt to complete your payment of{' '}
              <strong>KES {Number(totalAmount).toLocaleString()}</strong>.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Link
              to="/"
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-sm transition"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Catalog
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Checkout & Order</h1>
        <span className="text-sm text-gray-500">{cart.length} item(s) in cart</span>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Your Cart is Empty</h2>
          <p className="text-sm text-gray-500">Explore our featured products and add items to your cart.</p>
          <Link
            to="/"
            className="inline-block mt-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary & Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Order Items</h2>
              <div className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gray-50 overflow-hidden border border-gray-100 shrink-0">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=60'}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Qty: {item.quantity} &times; KES {Number(item.price).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="font-bold text-sm text-gray-900">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-400 hover:text-rose-500 transition p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Details & Payment */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="font-bold text-gray-900 text-lg">Customer Information</h2>

              <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    required
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="customer_email"
                    required
                    value={formData.customer_email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    M-Pesa Phone Number
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    required
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    placeholder="0712345678 or 254712345678"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    You will receive an STK Push PIN prompt on this number.
                  </span>
                </div>

                {/* Total breakdown */}
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>KES {Number(totalAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Delivery</span>
                    <span className="text-emerald-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span className="text-sky-600">KES {Number(totalAmount).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing STK Push...</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      <span>Pay with M-Pesa</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
