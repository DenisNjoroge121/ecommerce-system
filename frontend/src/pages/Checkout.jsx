import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import API from '../api';
import {
  ShoppingBag, ArrowLeft, Trash2, Smartphone, CreditCard,
  CheckCircle2, AlertCircle, Loader2, ShieldCheck, Printer,
  Clock, Zap, RefreshCw
} from 'lucide-react';

export default function Checkout() {
  const { cart, removeFromCart, clearCart, getTotal } = useCartStore();
  const user = useAuthStore((state) => state.user);

  const [paymentMethod, setPaymentMethod] = useState('mpesa'); // 'mpesa' | 'card'
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' | 'deposit_30' | 'deposit_50'

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

  // Waiting for M-Pesa PIN & Daraja confirmation state
  const [waitingForPin, setWaitingForPin] = useState(false);
  const [stkData, setStkData] = useState(null);
  const [pollSeconds, setPollSeconds] = useState(0);
  const [mpesaTxId, setMpesaTxId] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [checkingDaraja, setCheckingDaraja] = useState(false);
  const [darajaStatusMsg, setDarajaStatusMsg] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // Final successful receipt state
  const [completedPayment, setCompletedPayment] = useState(null);

  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const bagTotal = getTotal();

  // Calculate deposit amount and balance due based on chosen paymentMode
  let payAmount = bagTotal;
  let balanceDue = 0;

  if (paymentMode === 'deposit_30') {
    payAmount = Math.round(bagTotal * 0.3);
    balanceDue = Math.max(0, bagTotal - payAmount);
  } else if (paymentMode === 'deposit_50') {
    payAmount = Math.round(bagTotal * 0.5);
    balanceDue = Math.max(0, bagTotal - payAmount);
  } else {
    // 'full'
    payAmount = bagTotal;
    balanceDue = 0;
  }

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

  // -------------------------------------------------------------
  // REAL-TIME POLLING FOR M-PESA DARAJA PIN STATUS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!waitingForPin || !stkData?.checkout_id) return;

    timerIntervalRef.current = setInterval(() => {
      setPollSeconds((prev) => prev + 1);
    }, 1000);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await API.get('payments/status/', {
          params: { checkout_id: stkData.checkout_id, order_id: stkData.order_id },
        });

        if (res.data.is_complete) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setWaitingForPin(false);
          setCompletedPayment({
            method: 'mpesa',
            receipt_number: res.data.receipt_number || res.data.transaction_id,
            amount_paid: res.data.amount_paid,
            deposit_amount: res.data.deposit_amount,
            balance_due: res.data.balance_due,
            total_amount: res.data.total_amount,
            order_id: res.data.order_id,
            order_status: res.data.order_status,
            phone: stkData.phone,
            items: stkData.itemsSnapshot || [],
            payment_type: res.data.payment_type,
          });
          clearCart();
        } else if (res.data.failed) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setWaitingForPin(false);
          setErrorMsg(res.data.message || 'M-Pesa transaction was cancelled or timed out.');
        } else if (res.data.message) {
          setDarajaStatusMsg(res.data.message);
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      }
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [waitingForPin, stkData, clearCart]);

  // -------------------------------------------------------------
  // MANUAL CHECK FOR LIVE DARAJA STATUS
  // -------------------------------------------------------------
  const handleCheckDarajaStatus = async () => {
    if (!stkData?.checkout_id) return;
    setCheckingDaraja(true);
    setConfirmError('');
    try {
      const res = await API.get('payments/status/', {
        params: { checkout_id: stkData.checkout_id, order_id: stkData.order_id },
      });

      if (res.data.is_complete) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setWaitingForPin(false);
        setCompletedPayment({
          method: 'mpesa',
          receipt_number: res.data.receipt_number || res.data.transaction_id,
          amount_paid: res.data.amount_paid,
          deposit_amount: res.data.deposit_amount,
          balance_due: res.data.balance_due,
          total_amount: res.data.total_amount,
          order_id: res.data.order_id,
          order_status: res.data.order_status,
          phone: stkData.phone,
          items: stkData.itemsSnapshot || [],
          payment_type: res.data.payment_type,
        });
        clearCart();
      } else if (res.data.failed) {
        setConfirmError(res.data.message || 'M-Pesa transaction was cancelled or timed out.');
      } else {
        setDarajaStatusMsg(res.data.message || 'Waiting for PIN verification on phone...');
      }
    } catch (err) {
      console.warn('Manual status check error:', err);
      setConfirmError('Unable to check Safaricom Daraja status. Please try again.');
    } finally {
      setCheckingDaraja(false);
    }
  };

  // -------------------------------------------------------------
  // CONFIRM PAYMENT WITH DARAJA M-PESA TRANSACTION ID
  // -------------------------------------------------------------
  const handleConfirmPayment = async (e) => {
    if (e) e.preventDefault();
    if (!stkData?.checkout_id) return;

    const trimmedId = mpesaTxId.trim().toUpperCase();
    if (!trimmedId) {
      setConfirmError('Please enter the M-Pesa Transaction ID from your Safaricom SMS (e.g. NLJ7RT61SV).');
      return;
    }

    if (trimmedId.length < 6) {
      setConfirmError('M-Pesa Transaction ID must be at least 6 characters (e.g. NLJ7RT61SV).');
      return;
    }

    setConfirmingPayment(true);
    setConfirmError('');

    try {
      const res = await API.post('payments/confirm/', {
        checkout_id: stkData.checkout_id,
        order_id: stkData.order_id,
        transaction_id: trimmedId,
      });

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setWaitingForPin(false);
      setCompletedPayment({
        method: 'mpesa',
        receipt_number: res.data.receipt_number || trimmedId,
        amount_paid: res.data.amount_paid,
        deposit_amount: res.data.deposit_amount,
        balance_due: res.data.balance_due,
        total_amount: res.data.order?.total_amount || bagTotal,
        order_id: res.data.order?.order_id || stkData.order_id,
        order_status: res.data.order_status,
        phone: stkData.phone,
        items: stkData.itemsSnapshot || [],
        payment_type: stkData.payment_type,
      });
      clearCart();
    } catch (err) {
      console.error('Confirmation error:', err);
      setConfirmError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to confirm M-Pesa payment. Please verify the Transaction ID.'
      );
    } finally {
      setConfirmingPayment(false);
    }
  };

  // -------------------------------------------------------------
  // SUBMIT ORDER & TRIGGER PAYMENT
  // -------------------------------------------------------------
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const itemsSnapshot = [...cart];
      const isDeposit = paymentMode !== 'full';
      const actualDeposit = isDeposit ? payAmount : payAmount;
      const actualBalance = isDeposit ? balanceDue : 0;

      // 1. Create order in Django backend
      const orderPayload = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        total_amount: Number(bagTotal).toFixed(2),
        deposit_amount: Number(actualDeposit).toFixed(2),
        balance_due: Number(actualBalance).toFixed(2),
        status: 'pending',
        items: cart.map((item) => ({
          product: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      const orderRes = await API.post('orders/', orderPayload);
      const createdOrder = orderRes.data;

      // 2. Process Selected Payment Method
      if (paymentMethod === 'mpesa') {
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
          amount: payAmount,
          payment_type: isDeposit ? 'deposit' : 'full',
        });

        setStkData({
          checkout_id: stkRes.data.checkout_id,
          order_id: createdOrder.order_id,
          phone: formData.customer_phone,
          amount: payAmount,
          payment_type: isDeposit ? 'deposit' : 'full',
          bagTotal,
          balanceDue: actualBalance,
          itemsSnapshot,
          CustomerMessage: stkRes.data.CustomerMessage,
        });

        setPollSeconds(0);
        setWaitingForPin(true);
      } else {
        // CREDIT / DEBIT CARD PAYMENT
        const cardRes = await API.post('payments/card/', {
          order_id: createdOrder.order_id,
          card_number: cardData.cardNumber,
          expiry_date: cardData.expiryDate,
          cvv: cardData.cvv,
          cardholder_name: cardData.cardHolder || formData.customer_name,
          amount: payAmount,
          payment_type: isDeposit ? 'deposit' : 'full',
        });

        setCompletedPayment({
          method: 'card',
          receipt_number: cardRes.data.receipt_number,
          amount_paid: cardRes.data.amount,
          deposit_amount: cardRes.data.deposit_amount,
          balance_due: cardRes.data.balance_due,
          total_amount: bagTotal,
          order_id: createdOrder.order_id,
          order_status: cardRes.data.order_status,
          card_last4: cardRes.data.card_last4,
          cardholder_name: cardRes.data.cardholder_name,
          items: itemsSnapshot,
        });

        clearCart();
      }
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

  // -------------------------------------------------------------
  // SCREEN 1: WAITING FOR M-PESA PIN ENTRY (REAL-TIME STATUS)
  // -------------------------------------------------------------
  if (waitingForPin && stkData) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-400 via-teal-500 to-emerald-600 animate-pulse" />

          <div className="text-center space-y-3">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner relative z-10">
                <Smartphone className="w-10 h-10 animate-bounce" />
              </div>
              <div className="absolute inset-0 rounded-3xl bg-emerald-400/20 animate-ping -z-0" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200 mb-2">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for M-Pesa PIN ({pollSeconds}s)</span>
              </span>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Check Your Phone Screen</h1>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                An M-Pesa prompt has been dispatched to{' '}
                <strong className="text-gray-800">{stkData.phone}</strong>.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-gray-500">Order ID:</span>
              <span className="font-mono font-bold text-gray-900">{stkData.order_id?.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Total Bag Value:</span>
              <span className="font-bold text-gray-800">KES {Number(stkData.bagTotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
              <span>Amount Due Now ({stkData.payment_type === 'deposit' ? 'Deposit' : 'Full Payment'}):</span>
              <span className="text-sm">KES {Number(stkData.amount).toLocaleString()}</span>
            </div>
            {stkData.balanceDue > 0 && (
              <div className="flex justify-between items-center text-amber-700 font-medium">
                <span>Remaining Balance on Delivery:</span>
                <span>KES {Number(stkData.balanceDue).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="bg-sky-50/80 border border-sky-100 rounded-2xl p-4 text-xs text-sky-950 space-y-2">
            <h4 className="font-bold text-sky-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-sky-600" /> Instructions to complete payment:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sky-800 text-[11px] leading-relaxed">
              <li>Unlock your phone and look for the Safaricom pop-up prompt.</li>
              <li>Enter your secret <strong>M-Pesa PIN</strong> and press OK.</li>
              <li>Wait 3 seconds &mdash; this page will <strong>automatically confirm and issue your receipt</strong>!</li>
            </ol>
          </div>

          {/* CONFIRM PAYMENT WITH DARAJA M-PESA TRANSACTION ID */}
          <form onSubmit={handleConfirmPayment} className="space-y-3 pt-3 border-t border-gray-100">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                <span>Confirm with M-Pesa Transaction ID</span>
                <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Safaricom Daraja</span>
              </label>
              <p className="text-[11px] text-gray-500 leading-snug">
                Once you enter your M-Pesa PIN, Safaricom sends an SMS confirmation. Enter the Transaction ID (e.g. <strong className="font-mono text-emerald-700">NLJ7RT61SV</strong>) below to record and complete your order:
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={mpesaTxId}
                  onChange={(e) => {
                    setMpesaTxId(e.target.value.toUpperCase());
                    setConfirmError('');
                  }}
                  placeholder="e.g. NLJ7RT61SV"
                  maxLength={25}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm tracking-wider uppercase font-bold text-gray-900 bg-gray-50/50 placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
                />
              </div>
            </div>

            {confirmError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{confirmError}</span>
              </div>
            )}

            {darajaStatusMsg && !confirmError && (
              <div className="p-2.5 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-xs flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-600" />
                <span>{darajaStatusMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={confirmingPayment}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
              >
                {confirmingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying &amp; Recording Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Payment with M-Pesa ID</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCheckDarajaStatus}
                disabled={checkingDaraja}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                title="Query Safaricom Daraja API for live transaction status"
              >
                {checkingDaraja ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                )}
                <span>Check Live Status</span>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center">
              Your transaction is automatically polled from Safaricom Daraja, or enter your Transaction ID above for instant confirmation.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: FINAL CONFIRMED PAYMENT RECEIPT
  // -------------------------------------------------------------
  if (completedPayment) {
    const isPartial = completedPayment.balance_due > 0;

    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-8 space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="text-center space-y-1">
            <div className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1 bg-emerald-100 text-emerald-800">
              {isPartial ? 'Deposit Confirmed (Partial Payment)' : 'Payment Complete & Verified'}
            </div>
            <h1 className="text-2xl font-black text-gray-900">
              {isPartial ? 'Deposit Received Successfully!' : 'Transaction Completed!'}
            </h1>
            <p className="text-xs text-gray-500">
              Order Ref: <span className="font-mono font-bold text-gray-800">{completedPayment.order_id?.slice(0, 8)}</span>
            </p>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-400 block">Payment Method</span>
                <span className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
                  {completedPayment.method === 'mpesa' ? (
                    <>
                      <Smartphone className="w-4 h-4 text-emerald-400" /> M-Pesa STK Push
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-sky-400" /> Card ({completedPayment.card_last4 ? `•••• ${completedPayment.card_last4}` : 'Verified'})
                    </>
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Status</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-0.5 ${
                  isPartial ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {isPartial ? 'DEPOSIT PAID' : 'SETTLED IN FULL'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between items-center bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <span className="text-slate-400">
                  {completedPayment.method === 'mpesa' ? 'Daraja M-Pesa Transaction ID:' : 'Receipt Number:'}
                </span>
                <span className="font-mono font-black text-sm text-emerald-400 tracking-wider">
                  {completedPayment.receipt_number}
                </span>
              </div>
              {completedPayment.phone && (
                <div className="flex justify-between">
                  <span>Phone Debited:</span>
                  <span className="text-white font-medium">{completedPayment.phone}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-800">
                <span>Total Bag Value:</span>
                <span className="text-white font-bold">KES {Number(completedPayment.total_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Amount Paid Now (Deposit):</span>
                <span className="text-sm">KES {Number(completedPayment.amount_paid).toLocaleString()}</span>
              </div>
              {isPartial && (
                <div className="flex justify-between text-amber-300 font-bold bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/50">
                  <span>Remaining Balance on Delivery:</span>
                  <span className="text-sm">KES {Number(completedPayment.balance_due).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {completedPayment.items && completedPayment.items.length > 0 && (
            <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Bag Contents:</h4>
              <div className="divide-y divide-gray-100 text-xs">
                {completedPayment.items.map((it, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center text-gray-600">
                    <span>{it.quantity}x {it.title}</span>
                    <span className="font-semibold text-gray-800">KES {(it.price * it.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Official Receipt
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

  // -------------------------------------------------------------
  // SCREEN 3: NORMAL CHECKOUT FORM
  // -------------------------------------------------------------
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
        <span className="text-xs text-gray-500">{cart.length} item(s) in bag</span>
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
          <div className="lg:col-span-2 space-y-6">
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
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden transition"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Phone Number (M-Pesa / Delivery)
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    required
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    placeholder="0712345678 or 254712345678"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden transition"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 text-base">2. Payment Schedule</h2>
                  <p className="text-xs text-gray-500">Choose to pay in full or pay a deposit now and balance on delivery.</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-100">
                  Flexible Terms
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('full')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    paymentMode === 'full'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                  }`}
                >
                  <div className="font-bold text-xs">100% Full Payment</div>
                  <div className={`text-[11px] mt-1 ${paymentMode === 'full' ? 'text-slate-300' : 'text-gray-500'}`}>
                    KES {Number(bagTotal).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium mt-1">No balance due</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('deposit_30')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    paymentMode === 'deposit_30'
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20 text-emerald-950 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                  }`}
                >
                  <div className="font-bold text-xs">30% Deposit</div>
                  <div className="text-[11px] font-bold text-emerald-700 mt-1">
                    Pay KES {Number(Math.round(bagTotal * 0.3)).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Balance: KES {Number(bagTotal - Math.round(bagTotal * 0.3)).toLocaleString()}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('deposit_50')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    paymentMode === 'deposit_50'
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20 text-emerald-950 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                  }`}
                >
                  <div className="font-bold text-xs">50% Deposit</div>
                  <div className="text-[11px] font-bold text-emerald-700 mt-1">
                    Pay KES {Number(Math.round(bagTotal * 0.5)).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Balance: KES {Number(bagTotal - Math.round(bagTotal * 0.5)).toLocaleString()}
                  </div>
                </button>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-gray-500 block">Total Bag Amount:</span>
                  <span className="text-sm font-black text-gray-900">KES {Number(bagTotal).toLocaleString()}</span>
                </div>
                <div className="space-y-0.5 sm:text-center">
                  <span className="text-emerald-700 font-semibold block">Deposit to Pay Now:</span>
                  <span className="text-sm font-black text-emerald-700">KES {Number(payAmount).toLocaleString()}</span>
                </div>
                <div className="space-y-0.5 sm:text-right">
                  <span className="text-amber-700 font-semibold block">Remaining Balance:</span>
                  <span className="text-sm font-black text-amber-700">KES {Number(balanceDue).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-base">3. Payment Method</h2>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> 256-Bit Encrypted
                </span>
              </div>

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

              {paymentMethod === 'card' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
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

          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-base">Bag Summary</h3>

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

              <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Bag Subtotal</span>
                  <span>KES {Number(bagTotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery / Shipping</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total Bag Value</span>
                  <span>KES {Number(bagTotal).toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-sm font-black text-emerald-600 pt-2 border-t border-gray-100">
                  <span>Pay Now ({paymentMode === 'full' ? 'Full' : 'Deposit'})</span>
                  <span>KES {Number(payAmount).toLocaleString()}</span>
                </div>

                {balanceDue > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg">
                    <span>Balance on Delivery</span>
                    <span>KES {Number(balanceDue).toLocaleString()}</span>
                  </div>
                )}
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
                    <span>Initiating Payment...</span>
                  </>
                ) : paymentMethod === 'mpesa' ? (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>
                      Pay KES {Number(payAmount).toLocaleString()} with M-Pesa
                    </span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Confirm Card Payment of KES {Number(payAmount).toLocaleString()}</span>
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
