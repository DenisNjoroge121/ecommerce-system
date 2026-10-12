import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import API from '../api';
import {
  ShoppingBag, ArrowLeft, Trash2, Smartphone, CreditCard,
  CheckCircle2, AlertCircle, Loader2, ShieldCheck, Printer
} from 'lucide-react';

export default function Checkout() {
  const { cart, removeFromCart, clearCart, getTotal } = useCartStore();
  const user = useAuthStore((state) => state.user);

  const [paymentMethod, setPaymentMethod] = useState('mpesa'); // 'mpesa' | 'card'

  const [formData, setFormData] = useState({
    customer_name: user?.username || '',
    customer_email: user?.email || '',
    customer_phone: '',
  });

  // Card details state
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardHolder: user?.username || '',
    expiryDate: '',
    cvv: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);

  const totalAmount = getTotal();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardData({ ...cardData, cardNumber: formatted });
  };

  const handleExpiryChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    setCardData({ ...cardData, expiryDate: raw });
  };

  const handleCvvChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardData({ ...cardData, cvv: raw });
  };

  const detectCardType = (number) => {
    const clean = number.replace(/\s/g, '');
    if (clean.startsWith('4')) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'Mastercard';
    if (/^3[47]/.test(clean)) return 'Amex';
    return 'Card';
  };

  const handleSubmitOrder = async (e) => {
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

      // 2. Process Chosen Payment Method
      if (paymentMethod === 'mpesa') {
        // M-PESA STK PUSH
        let phone = formData.customer_phone.trim().replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) {
          phone = '254' + phone.slice(1);
        } else if (phone.startsWith('+254')) {
          phone = phone.slice(1);
        } else if (!phone.startsWith('254') && phone.length === 9) {
          phone = '254' + phone;
        }

        const stkRes = await API.post('payments/stk-push/', {
          phone_number: phone,
          order_id: createdOrder.order_id,
        });

        setPaymentResult({
          method: 'mpesa',
          order: createdOrder,
          stk: stkRes.data,
          phone: formData.customer_phone,
          amount: totalAmount,
        });
      } else {
        // CREDIT / DEBIT CARD PAYMENT
        const cardRes = await API.post('payments/card/', {
          order_id: createdOrder.order_id,
          card_number: cardData.cardNumber,
          expiry_date: cardData.expiryDate,
          cvv: cardData.cvv,
          cardholder_name: cardData.cardHolder || formData.customer_name,
        });

        setPaymentResult({
          method: 'card',
          order: createdOrder,
          cardDetails: cardRes.data,
          amount: totalAmount,
        });
      }

      clearCart();
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMsg(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Unable to process checkout. Please verify your payment details.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS / RECEIPT VIEW
  if (paymentResult) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {paymentResult.method === 'card' ? 'Payment Successful!' : 'Order Placed!'}
            </h1>
            <p className="text-xs text-gray-500">
              Order ID:{' '}
              <span className="font-mono font-semibold text-slate-800">
                {paymentResult.order?.order_id?.slice(0, 8)}
              </span>
            </p>
          </div>

          {/* Details Card */}
          {paymentResult.method === 'mpesa' ? (
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-sm text-sky-950 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sky-900">
                <Smartphone className="w-5 h-5 text-sky-600" />
                <span>M-Pesa STK Prompt Sent</span>
              </div>
              <p className="text-xs text-sky-800 leading-relaxed">
                A prompt has been sent to your phone (<strong>{paymentResult.phone}</strong>). Please enter your M-Pesa PIN on your phone to complete payment of{' '}
                <strong>KES {Number(paymentResult.amount).toLocaleString()}</strong>.
              </p>
              <div className="text-[11px] text-sky-700 bg-white/60 p-2.5 rounded-xl">
                Status: {paymentResult.stk?.status || 'Pending confirmation'}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs text-slate-400 block">Payment Method</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
                    <CreditCard className="w-4 h-4 text-sky-400" /> Card ({paymentResult.cardDetails?.card_last4 ? `•••• ${paymentResult.cardDetails.card_last4}` : 'Verified'})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Status</span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    PAID
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Receipt Number:</span>
                  <span className="font-mono font-semibold text-white">{paymentResult.cardDetails?.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cardholder:</span>
                  <span className="text-white">{paymentResult.cardDetails?.cardholder_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount Paid:</span>
                  <span className="text-sky-400 font-bold text-sm">KES {Number(paymentResult.amount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
            <Link
              to="/"
              className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition text-center"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Store
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Secure Checkout</h1>
        <span className="text-xs text-gray-500">{cart.length} item(s)</span>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs">
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
          <p className="text-xs text-gray-500">Explore products and add items to your cart before proceeding.</p>
          <Link
            to="/"
            className="inline-block mt-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Customer details & Payment Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-base">1. Customer Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    placeholder="e.g. Denis Njoroge"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
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
                    placeholder="denis@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Phone Number (Contact / Delivery)
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    required
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    placeholder="0712345678 or +254712345678"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-base">2. Payment Method</h2>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> 256-Bit Encrypted
                </span>
              </div>

              {/* Tab options */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mpesa')}
                  className={`p-4 rounded-xl border text-left transition flex items-center gap-3 ${
                    paymentMethod === 'mpesa'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${paymentMethod === 'mpesa' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">M-Pesa STK Push</h4>
                    <p className="text-[11px] text-gray-500">Pay via phone PIN prompt</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-xl border text-left transition flex items-center gap-3 ${
                    paymentMethod === 'card'
                      ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-600/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${paymentMethod === 'card' ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">Credit / Debit Card</h4>
                    <p className="text-[11px] text-gray-500">Visa, Mastercard, etc.</p>
                  </div>
                </button>
              </div>

              {/* Conditional Card Fields */}
              {paymentMethod === 'card' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  {/* Card visual banner */}
                  <div className="bg-linear-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono tracking-widest text-slate-400">DEBIT / CREDIT</span>
                      <span className="font-bold text-sky-400">{detectCardType(cardData.cardNumber)}</span>
                    </div>
                    <div className="font-mono text-lg tracking-widest text-center py-2">
                      {cardData.cardNumber || '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <div>
                        <span className="text-[9px] uppercase text-slate-500 block">Cardholder</span>
                        <span>{cardData.cardHolder || formData.customer_name || 'YOUR NAME'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase text-slate-500 block">Expires</span>
                        <span>{cardData.expiryDate || 'MM/YY'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Form Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        required={paymentMethod === 'card'}
                        value={cardData.cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        required={paymentMethod === 'card'}
                        value={cardData.cardHolder}
                        onChange={(e) => setCardData({ ...cardData, cardHolder: e.target.value })}
                        placeholder="Name as it appears on card"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required={paymentMethod === 'card'}
                        value={cardData.expiryDate}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        CVV Code
                      </label>
                      <input
                        type="password"
                        required={paymentMethod === 'card'}
                        value={cardData.cvv}
                        onChange={handleCvvChange}
                        placeholder="123"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Pay Action */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-base">Order Summary</h3>

              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <h4 className="font-semibold text-gray-900 line-clamp-1">{item.title}</h4>
                      <span className="text-gray-400">Qty: {item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-300 hover:text-rose-500 transition p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>KES {Number(totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total Amount</span>
                  <span className="text-sky-600">KES {Number(totalAmount).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full mt-4 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl text-xs transition shadow-sm ${
                  paymentMethod === 'mpesa'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : paymentMethod === 'mpesa' ? (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Pay KES {Number(totalAmount).toLocaleString()} with M-Pesa</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Confirm Card Payment of KES {Number(totalAmount).toLocaleString()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
