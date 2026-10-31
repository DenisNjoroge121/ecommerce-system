import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import { useAuthStore } from '../store/useAuthStore';
import {
  Package, ShoppingCart, Smartphone, Plus, Edit2, Trash2,
  DollarSign, Send, X, RefreshCw, ArrowLeft, BarChart3,
  Lock, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Loader2, User,
  Calendar, ChevronDown, ChevronUp, Printer, Check, CreditCard,
  Wallet, Layers
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated, login } = useAuthStore();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'analytics' | 'products' | 'stk' | 'account'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Expanded Bag Items inside Orders list
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Record Balance Payment Modal state
  const [balanceModalOrder, setBalanceModalOrder] = useState(null);
  const [balanceForm, setBalanceForm] = useState({
    amount: '',
    payment_method: 'mpesa',
    receipt_number: '',
  });
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);

  // Trade Analytics & Calculation State
  const [analyticsPeriod, setAnalyticsPeriod] = useState('week'); // 'week' | 'month' | 'year' | 'today' | 'custom'
  const [customRange, setCustomRange] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Embedded Admin Login State
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  // Product CRUD Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    title: '',
    category: '',
    price: '',
    stock: '',
    description: '',
    image: '',
    is_active: true,
  });

  // STK Push Tool state
  const [stkForm, setStkForm] = useState({
    phone_number: '254700000000',
    amount: '100',
    order_id: '',
  });
  const [stkStatus, setStkStatus] = useState(null);
  const [stkLoading, setStkLoading] = useState(false);

  // Change Password state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  // Printable Bag Invoice Modal state
  const [printableOrder, setPrintableOrder] = useState(null);

  // Notification message
  const [bannerMsg, setBannerMsg] = useState(null);

  const showNotification = (text, type = 'success') => {
    setBannerMsg({ text, type });
    setTimeout(() => setBannerMsg(null), 4000);
  };

  // -----------------------------------------------------------
  // FETCH CORE STORE DATA
  // -----------------------------------------------------------
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, ordRes] = await Promise.all([
        API.get('products/'),
        API.get('categories/'),
        API.get('orders/'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setOrders(ordRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------
  // FETCH TRADE SUMMARY ANALYTICS
  // -----------------------------------------------------------
  const fetchAnalytics = async (period = analyticsPeriod, customDates = customRange) => {
    setAnalyticsLoading(true);
    try {
      const params = { period };
      if (period === 'custom') {
        params.start_date = customDates.start_date;
        params.end_date = customDates.end_date;
      }
      const res = await API.get('analytics/trade-summary/', { params });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      let isMounted = true;
      Promise.all([
        API.get('products/'),
        API.get('categories/'),
        API.get('orders/'),
        API.get('analytics/trade-summary/', { params: { period: 'week' } }),
      ])
        .then(([prodRes, catRes, ordRes, analyticsRes]) => {
          if (isMounted) {
            setProducts(prodRes.data);
            setCategories(catRes.data);
            setOrders(ordRes.data);
            setAnalyticsData(analyticsRes.data);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Failed to load admin data:', err);
          }
        });

      // Auto-sync every 10 seconds so customer payments reflect immediately
      const autoSyncInterval = setInterval(() => {
        API.get('orders/')
          .then((res) => {
            if (isMounted) setOrders(res.data);
          })
          .catch(() => {});
      }, 10000);

      return () => {
        isMounted = false;
        clearInterval(autoSyncInterval);
      };
    }
  }, [isAuthenticated, isAdmin]);

  // When switching to analytics tab or changing period
  const handlePeriodChange = (newPeriod) => {
    setAnalyticsPeriod(newPeriod);
    fetchAnalytics(newPeriod, customRange);
  };

  const handleCustomRangeCalculate = (e) => {
    e.preventDefault();
    fetchAnalytics('custom', customRange);
  };

  // -----------------------------------------------------------
  // EMBEDDED ADMIN LOGIN HANDLER
  // -----------------------------------------------------------
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginLoading(true);
    setAdminLoginError('');

    try {
      const res = await API.post('auth/login/', adminLoginForm);
      const loggedUser = res.data.user;

      if (!loggedUser.is_staff && !loggedUser.is_superuser) {
        setAdminLoginError('This account does not have Administrator privileges. Please ensure "Staff status" is enabled.');
        return;
      }

      login(res.data.token, loggedUser);
      showNotification(`Welcome back, ${loggedUser.username}!`);
    } catch (err) {
      setAdminLoginError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Invalid credentials. Please verify username and password.'
      );
    } finally {
      setAdminLoginLoading(false);
    }
  };

  // -----------------------------------------------------------
  // CHANGE PASSWORD HANDLER
  // -----------------------------------------------------------
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await API.post('auth/change-password/', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });

      setPasswordStatus({ type: 'success', text: res.data.message || 'Password updated successfully!' });
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      showNotification('Your admin password has been changed successfully!');
    } catch (err) {
      setPasswordStatus({
        type: 'error',
        text: err.response?.data?.error || 'Failed to change password. Please check your current password.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // -----------------------------------------------------------
  // PRODUCT CRUD
  // -----------------------------------------------------------
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      title: '',
      category: categories[0]?.id || '',
      price: '',
      stock: '10',
      description: '',
      image: '',
      is_active: true,
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      title: prod.title || '',
      category: prod.category || categories[0]?.id || '',
      price: String(prod.price || ''),
      stock: String(prod.stock || '0'),
      description: prod.description || '',
      image: prod.image || '',
      is_active: Boolean(prod.is_active),
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: productForm.title,
        category: productForm.category || categories[0]?.id,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock, 10),
        description: productForm.description,
        image: productForm.image,
        is_active: productForm.is_active,
      };

      if (editingProduct) {
        await API.patch(`products/${editingProduct.id}/`, payload);
        showNotification(`Product "${payload.title}" updated successfully!`);
      } else {
        await API.post('products/', payload);
        showNotification(`Product "${payload.title}" added to inventory!`);
      }

      setIsProductModalOpen(false);
      fetchAdminData();
    } catch (err) {
      console.error('Failed to save product:', err);
      showNotification('Failed to save product. Please check form inputs.', 'error');
    }
  };

  const handleDeleteProduct = async (productId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await API.delete(`products/${productId}/`);
      showNotification(`Product "${title}" was deleted.`);
      fetchAdminData();
    } catch (err) {
      console.error('Failed to delete product:', err);
      showNotification('Could not delete product.', 'error');
    }
  };

  // -----------------------------------------------------------
  // ORDER STATUS UPDATE & STK TRIGGER
  // -----------------------------------------------------------
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await API.patch(`orders/${orderId}/`, { status: newStatus });
      showNotification(`Order status updated to "${newStatus}".`);
      fetchAdminData();
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to update order status:', err);
      showNotification('Failed to update status.', 'error');
    }
  };

  // Collect Remaining Balance via STK Push
  const handleTriggerBalanceSTK = async (order) => {
    const balance = Number(order.balance_due);
    if (balance <= 0) {
      showNotification('This order is already settled in full!', 'error');
      return;
    }

    let phone = String(order.customer_phone).trim().replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    else if (!phone.startsWith('254') && phone.length === 9) phone = '254' + phone;

    setStkLoading(true);
    try {
      await API.post('payments/stk-push/', {
        phone_number: phone,
        order_id: order.order_id,
        amount: balance,
        payment_type: 'final',
      });
      showNotification(`M-Pesa balance STK push of KES ${balance.toLocaleString()} sent to ${phone}!`);
      fetchAdminData();
    } catch (err) {
      console.error('Failed to trigger balance STK:', err);
      showNotification('Failed to dispatch STK push. Check phone format.', 'error');
    } finally {
      setStkLoading(false);
    }
  };

  // Record Balance Payment (Cash or M-Pesa Till)
  const handleOpenRecordBalance = (order) => {
    setBalanceModalOrder(order);
    setBalanceForm({
      amount: String(order.balance_due),
      payment_method: 'mpesa',
      receipt_number: `MAN-REC-${Date.now().toString().slice(-6)}`,
    });
  };

  const handleSaveBalancePayment = async (e) => {
    e.preventDefault();
    if (!balanceModalOrder) return;

    setBalanceSubmitting(true);
    try {
      await API.post('payments/record-balance/', {
        order_id: balanceModalOrder.order_id,
        amount: balanceForm.amount,
        payment_method: balanceForm.payment_method,
        receipt_number: balanceForm.receipt_number,
      });

      showNotification(`Balance payment of KES ${balanceForm.amount} recorded for Order ${balanceModalOrder.order_id.slice(0, 8)}!`);
      setBalanceModalOrder(null);
      fetchAdminData();
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to record balance:', err);
      showNotification('Failed to record balance payment.', 'error');
    } finally {
      setBalanceSubmitting(false);
    }
  };

  const handleManualSTK = async (e) => {
    e.preventDefault();
    setStkLoading(true);
    setStkStatus(null);

    try {
      const res = await API.post('payments/stk-push/', {
        phone_number: stkForm.phone_number,
        amount: stkForm.amount,
        order_id: stkForm.order_id || undefined,
      });
      setStkStatus(res.data);
      showNotification(`STK push sent to ${stkForm.phone_number} for KES ${stkForm.amount}!`);
      fetchAdminData();
    } catch (err) {
      setStkStatus({ error: err.response?.data?.error || 'Failed to dispatch STK push.' });
    } finally {
      setStkLoading(false);
    }
  };

  // -----------------------------------------------------------
  // INLINE ADMIN LOGIN IF NOT AUTHENTICATED OR NOT ADMIN
  // -----------------------------------------------------------
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Store Owner Portal</h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              Sign in with your administrator credentials to access bag orders, payment tracking, and trade summaries.
            </p>
          </div>

          {adminLoginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{adminLoginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Admin Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={adminLoginForm.username}
                  onChange={(e) => setAdminLoginForm({ ...adminLoginForm, username: e.target.value })}
                  placeholder="Enter administrator username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={adminLoginForm.password}
                  onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={adminLoginLoading}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-600 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
            >
              {adminLoginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span>Access Admin Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 text-center space-y-2">
            <button
              type="button"
              onClick={() => setAdminLoginForm({ username: 'admin', password: 'admin123' })}
              className="text-xs text-sky-600 hover:text-sky-700 underline font-medium"
            >
              Fill Demo Developer Admin (admin / admin123)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate high-level stats from all orders
  const totalTradeAll = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalDepositsAll = orders.reduce((sum, o) => sum + Number(o.deposit_amount || 0), 0);
  const totalBalancesAll = orders.reduce((sum, o) => sum + Number(o.balance_due || 0), 0);
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto py-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Storefront
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-semibold text-sky-600">Admin Control Center</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-black text-gray-900">Store Administration</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
              Logged in as {user?.username}
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live Sync Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchAdminData();
              fetchAnalytics();
              showNotification('Store data synchronized with Safaricom and database.');
            }}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-700 transition text-xs flex items-center gap-1.5"
            title="Sync latest customer payments and transactions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddProduct}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Banner alert */}
      {bannerMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between ${
            bannerMsg.type === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button type="button" onClick={() => setBannerMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Metric Cards (Bags, Deposits, Balances) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Total Bag Trade</span>
            <ShoppingCart className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">KES {totalTradeAll.toLocaleString()}</div>
          <div className="text-[11px] text-gray-400">{orders.length} customer bags placed</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Deposits Collected</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">KES {totalDepositsAll.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-600 font-medium">Real cash received</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Outstanding Balances</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">KES {totalBalancesAll.toLocaleString()}</div>
          <div className="text-[11px] text-amber-700 font-medium">Pending on delivery/bags</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Products Inventory</span>
            <Package className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-800">{products.length} Items</div>
          <div className="text-[11px] text-sky-600 font-medium">{pendingOrdersCount} orders pending</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-6 text-xs font-bold overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`pb-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Orders, Bags &amp; Balances ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('analytics');
            fetchAnalytics(analyticsPeriod, customRange);
          }}
          className={`pb-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Trade Summaries &amp; Calculations (Week/Month/Year)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`pb-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products Inventory ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stk')}
          className={`pb-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'stk'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>M-Pesa STK Push Launcher</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`pb-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'account'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Account Settings</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ORDERS, BAGS & BALANCE MANAGEMENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 bg-gray-50/75 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Customer Orders &amp; Bag Balances</h3>
              <p className="text-xs text-gray-500">
                Track customer deposits paid via M-Pesa, view items in each bag, and collect remaining balances.
              </p>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Paid Full
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Deposit Paid (Partial)
              </span>
              <span className="flex items-center gap-1 font-semibold text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Pending
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Bag Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Total Bag</th>
                  <th className="py-3 px-4 text-emerald-700">Deposit Paid</th>
                  <th className="py-3 px-4 text-amber-700">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">
                      No customer orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const isExpanded = expandedOrderId === o.order_id;
                    const balance = Number(o.balance_due || 0);
                    const deposit = Number(o.deposit_amount || 0);
                    const total = Number(o.total_amount || 0);

                    return (
                      <div key={o.order_id} style={{ display: 'contents' }}>
                        <tr className={`hover:bg-gray-50/50 transition ${isExpanded ? 'bg-sky-50/20' : ''}`}>
                          {/* Bag Ref */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => setExpandedOrderId(isExpanded ? null : o.order_id)}
                              className="font-mono font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1"
                              title="Click to view items in this bag"
                            >
                              <span>{String(o.order_id).slice(0, 8)}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <span className="text-[10px] text-gray-400 block">
                              {o.items?.length || 0} item(s) in bag
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900">{o.customer_name}</div>
                            <div className="text-[11px] text-gray-400">
                              {o.customer_phone} &bull; {o.customer_email}
                            </div>
                          </td>

                          {/* Total Bag */}
                          <td className="py-3.5 px-4 font-black text-gray-900">
                            KES {total.toLocaleString()}
                          </td>

                          {/* Deposit Paid */}
                          <td className="py-3.5 px-4 font-black text-emerald-600">
                            KES {deposit.toLocaleString()}
                            {o.transactions && o.transactions.length > 0 && o.transactions[0].receipt_number && (
                              <span className="block text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                                {o.transactions[0].receipt_number}
                              </span>
                            )}
                          </td>

                          {/* Balance Due */}
                          <td className="py-3.5 px-4">
                            {balance > 0 ? (
                              <span className="font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 block text-center">
                                KES {balance.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Settled (KES 0)
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <select
                              value={o.status}
                              onChange={(e) => handleUpdateOrderStatus(o.order_id, e.target.value)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-hidden cursor-pointer ${
                                o.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : o.status === 'partially_paid'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : o.status === 'pending'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : o.status === 'shipped'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              <option value="pending">Pending Payment</option>
                              <option value="partially_paid">Deposit Paid</option>
                              <option value="paid">Paid in Full</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-gray-400">
                            {new Date(o.created_at).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {balance > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerBalanceSTK(o)}
                                    disabled={stkLoading}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] transition shadow-xs flex items-center gap-1"
                                    title="Send M-Pesa STK prompt for remaining balance"
                                  >
                                    <Smartphone className="w-3 h-3" />
                                    <span>STK Balance</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecordBalance(o)}
                                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-[11px] transition flex items-center gap-1"
                                    title="Record payment of remaining balance"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    <span>Record Pay</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPrintableOrder(o)}
                                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-[11px] transition flex items-center gap-1"
                                  title="Print Bag Slip / Invoice"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Slip</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Bag Contents Row */}
                        {isExpanded && (
                          <tr className="bg-sky-50/30 border-b border-gray-100">
                            <td colSpan={8} className="p-4">
                              <div className="bg-white rounded-xl p-4 border border-sky-100 shadow-xs space-y-3">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                  <span className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-sky-600" />
                                    Items in Bag for Order {o.order_id.slice(0, 8)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPrintableOrder(o)}
                                    className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                                  >
                                    <Printer className="w-3 h-3" /> Print Delivery Slip
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {o.items?.map((it, idx) => (
                                    <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-md bg-gray-200 overflow-hidden shrink-0">
                                        {it.product_image ? (
                                          <img src={it.product_image} alt={it.product_title} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Package className="w-5 h-5" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-gray-900 truncate">{it.product_title}</div>
                                        <div className="text-[11px] text-gray-500">
                                          Qty: {it.quantity} &times; KES {Number(it.price).toLocaleString()}
                                        </div>
                                      </div>
                                      <div className="font-bold text-gray-800 text-right">
                                        KES {(it.price * it.quantity).toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex flex-wrap justify-between text-xs text-gray-600">
                                  <span>Total Bag: <strong className="text-gray-900">KES {total.toLocaleString()}</strong></span>
                                  <span>Deposit Paid: <strong className="text-emerald-700">KES {deposit.toLocaleString()}</strong></span>
                                  <span>Balance Remaining: <strong className="text-amber-700">KES {balance.toLocaleString()}</strong></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </div>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: TRADE SUMMARIES & FINANCIAL CALCULATOR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sky-600" />
                  <span>Trade Summary &amp; Financial Calculations</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Analyze gross bag trade, deposits collected via M-Pesa, and accounts receivable across any week, month, or year.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePeriodChange('today')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    analyticsPeriod === 'today'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => handlePeriodChange('week')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    analyticsPeriod === 'week'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Whole Week
                </button>

                <button
                  type="button"
                  onClick={() => handlePeriodChange('month')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    analyticsPeriod === 'month'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Whole Month
                </button>

                <button
                  type="button"
                  onClick={() => handlePeriodChange('year')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    analyticsPeriod === 'year'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Whole Year
                </button>

                <button
                  type="button"
                  onClick={() => handlePeriodChange('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    analyticsPeriod === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>

            <form onSubmit={handleCustomRangeCalculate} className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400" /> Custom Trade Calculator:
              </span>
              <div className="flex items-center gap-2">
                <label className="text-gray-500">From:</label>
                <input
                  type="date"
                  value={customRange.start_date}
                  onChange={(e) => setCustomRange({ ...customRange, start_date: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-500">To:</label>
                <input
                  type="date"
                  value={customRange.end_date}
                  onChange={(e) => setCustomRange({ ...customRange, end_date: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={analyticsLoading}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg transition shadow-xs"
              >
                {analyticsLoading ? 'Calculating...' : 'Calculate Summary'}
              </button>
            </form>
          </div>

          {analyticsData && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                  Summary for: <span className="text-sky-600">{analyticsData.period_label}</span>
                </h4>
                <span className="text-xs text-gray-500">
                  {analyticsData.metrics.orders_count} bags traded
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-gray-400 block">Gross Trade Volume</span>
                  <div className="text-2xl font-black text-gray-900">
                    KES {analyticsData.metrics.total_trade_volume.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-gray-400 block">Total customer bags</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-emerald-600 block">Deposits Collected</span>
                  <div className="text-2xl font-black text-emerald-600">
                    KES {analyticsData.metrics.total_deposits_collected.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium block">
                    {analyticsData.metrics.settlement_rate}% of trade collected
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-amber-600 block">Outstanding Balances</span>
                  <div className="text-2xl font-black text-amber-600">
                    KES {analyticsData.metrics.total_balance_due.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium block">Due on deliveries</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-sky-600 block">Average Bag Value</span>
                  <div className="text-2xl font-black text-sky-600">
                    KES {analyticsData.metrics.average_bag_value.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-gray-400 block">Per order average</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3 text-xs">
                  <h5 className="font-bold text-gray-900 text-sm">Bag Settlement Breakdown</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Fully Settled Bags:
                      </span>
                      <strong className="text-gray-900">{analyticsData.metrics.paid_orders}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Deposit Paid (Partial):
                      </span>
                      <strong className="text-gray-900">{analyticsData.metrics.partial_orders}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Pending Payment:
                      </span>
                      <strong className="text-gray-900">{analyticsData.metrics.pending_orders}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3 text-xs">
                  <h5 className="font-bold text-gray-900 text-sm">Payment Methods Collected</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Lipa Na M-Pesa:
                      </span>
                      <strong className="text-emerald-700">
                        KES {analyticsData.payment_methods.mpesa.toLocaleString()}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-sky-600" /> Credit / Debit Card:
                      </span>
                      <strong className="text-sky-700">
                        KES {analyticsData.payment_methods.card.toLocaleString()}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-50">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-slate-600" /> Cash Settlements:
                      </span>
                      <strong className="text-slate-800">
                        KES {analyticsData.payment_methods.cash.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {analyticsData.breakdown && analyticsData.breakdown.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                  <div className="p-4 bg-gray-50/75 border-b border-gray-100 flex justify-between items-center">
                    <h5 className="font-bold text-gray-900 text-xs">
                      Time-Series Trade Distribution ({analyticsPeriod.toUpperCase()})
                    </h5>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Trade Report
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                        <tr>
                          <th className="py-3 px-4">Period / Day</th>
                          <th className="py-3 px-4">Bags Count</th>
                          <th className="py-3 px-4">Gross Trade</th>
                          <th className="py-3 px-4 text-emerald-700">Deposits Paid</th>
                          <th className="py-3 px-4 text-amber-700">Balance Pending</th>
                          <th className="py-3 px-4">Collection Visual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {analyticsData.breakdown.map((row, idx) => {
                          const rate = row.trade_volume > 0 ? Math.min(100, Math.round((row.deposits_collected / row.trade_volume) * 100)) : 0;
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-3 px-4 font-bold text-gray-900">{row.label}</td>
                              <td className="py-3 px-4">{row.orders_count}</td>
                              <td className="py-3 px-4 font-bold">KES {row.trade_volume.toLocaleString()}</td>
                              <td className="py-3 px-4 font-bold text-emerald-600">KES {row.deposits_collected.toLocaleString()}</td>
                              <td className="py-3 px-4 font-bold text-amber-600">KES {row.balance_due.toLocaleString()}</td>
                              <td className="py-3 px-4 w-48">
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-2.5 rounded-full transition-all"
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-400 mt-0.5 block">{rate}% Collected</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: PRODUCTS INVENTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price (KES)</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                        <img
                          src={p.image || 'https://via.placeholder.com/100'}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 line-clamp-1">{p.title}</div>
                        <div className="text-[11px] text-gray-400 line-clamp-1">{p.description}</div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-gray-600">
                      {p.category_name || 'Uncategorized'}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      KES {Number(p.price).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.stock <= 0
                            ? 'bg-rose-50 text-rose-700'
                            : p.stock <= 5
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {p.stock} in stock
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.is_active ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditProduct(p)}
                          className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-gray-100 rounded-lg transition"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id, p.title)}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-gray-100 rounded-lg transition"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: M-PESA STK PUSH LAUNCHER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'stk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>On-Demand M-Pesa STK Push Tool</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Trigger Lipa Na M-Pesa STK push prompts directly for customer deposits or balance collections.
              </p>
            </div>

            <form onSubmit={handleManualSTK} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Customer Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={stkForm.phone_number}
                  onChange={(e) => setStkForm({ ...stkForm, phone_number: e.target.value })}
                  placeholder="2547XXXXXXXX or 07XXXXXXXX"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Amount in KES
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stkForm.amount}
                  onChange={(e) => setStkForm({ ...stkForm, amount: e.target.value })}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Link to Bag / Order (Optional)
                </label>
                <select
                  value={stkForm.order_id}
                  onChange={(e) => setStkForm({ ...stkForm, order_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">No specific order (Direct Push)</option>
                  {orders.map((o) => (
                    <option key={o.order_id} value={o.order_id}>
                      Order {o.order_id.slice(0, 8)} - Balance: KES {o.balance_due} ({o.customer_name})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={stkLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>{stkLoading ? 'Dispatching STK Push...' : 'Trigger STK Prompt'}</span>
              </button>
            </form>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-slate-400">Daraja STK Response Monitor</span>
              <span className="text-emerald-400 font-bold">Lipa Na M-Pesa</span>
            </div>

            {stkStatus ? (
              <pre className="p-4 bg-slate-950 rounded-xl overflow-x-auto text-emerald-300 leading-relaxed">
                {JSON.stringify(stkStatus, null, 2)}
              </pre>
            ) : (
              <div className="py-12 text-center text-slate-500">
                Trigger an STK push using the form to view real-time Safaricom callback / checkout metadata.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: ACCOUNT SETTINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'account' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-sky-600" />
              <span>Change Store Owner Password</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Update your administrative password for the online control center.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-400 block text-[11px] uppercase font-semibold">Active Admin Account</span>
              <span className="font-bold text-gray-900 text-sm">{user?.username}</span>
              {user?.email && <span className="text-gray-500 ml-2">({user?.email})</span>}
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-100 text-[11px]">
              Verified Store Owner
            </span>
          </div>

          {passwordStatus && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                passwordStatus.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {passwordStatus.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{passwordStatus.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 uppercase mb-1">
                Current Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  required
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 uppercase mb-1">
                New Secure Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 uppercase mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-semibold rounded-xl transition shadow-xs flex items-center gap-2"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: RECORD BALANCE PAYMENT */}
      {/* ------------------------------------------------------------- */}
      {balanceModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Record Balance Settlement</h3>
                <p className="text-xs text-gray-500">Order {balanceModalOrder.order_id.slice(0, 8)} ({balanceModalOrder.customer_name})</p>
              </div>
              <button
                type="button"
                onClick={() => setBalanceModalOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-amber-800">Total Bag Value:</span>
                <span className="font-bold text-amber-950">KES {Number(balanceModalOrder.total_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-800">Deposit Paid:</span>
                <span className="font-bold text-emerald-700">KES {Number(balanceModalOrder.deposit_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-1 border-t border-amber-200 text-amber-900">
                <span>Remaining Balance Due:</span>
                <span>KES {Number(balanceModalOrder.balance_due).toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleSaveBalancePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={balanceForm.payment_method}
                  onChange={(e) => setBalanceForm({ ...balanceForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="mpesa">Lipa Na M-Pesa Till / Paybill</option>
                  <option value="cash">Cash on Delivery / Pickup</option>
                  <option value="card">Card Terminal / POS</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Amount Received (KES)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={balanceForm.amount}
                  onChange={(e) => setBalanceForm({ ...balanceForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Receipt / Transaction Ref (Optional)
                </label>
                <input
                  type="text"
                  value={balanceForm.receipt_number}
                  onChange={(e) => setBalanceForm({ ...balanceForm, receipt_number: e.target.value })}
                  placeholder="e.g. QK892716 or CASH"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBalanceModalOrder(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={balanceSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  {balanceSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Settlement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: PRINTABLE BAG INVOICE & DELIVERY SLIP */}
      {/* ------------------------------------------------------------- */}
      {printableOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 block">STORE DELIVERY SLIP</span>
                <h3 className="text-xl font-black text-gray-900">Belo.Creations</h3>
                <p className="text-xs text-gray-500">Order ID: {printableOrder.order_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setPrintableOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-gray-400 uppercase text-[10px] font-bold">Customer:</span>
                <div className="font-bold text-gray-800">{printableOrder.customer_name}</div>
                <div className="text-gray-500">{printableOrder.customer_phone}</div>
                <div className="text-gray-500">{printableOrder.customer_email}</div>
              </div>
              <div className="space-y-0.5 text-right">
                <span className="text-gray-400 uppercase text-[10px] font-bold">Date &amp; Status:</span>
                <div className="text-gray-700">{new Date(printableOrder.created_at).toLocaleDateString()}</div>
                <div className="font-bold text-emerald-700 uppercase">{printableOrder.status}</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-gray-50 px-3 py-2 font-bold text-gray-700 border-b border-gray-200 flex justify-between">
                <span>Bag Item</span>
                <span>Subtotal</span>
              </div>
              <div className="divide-y divide-gray-100 p-2">
                {printableOrder.items?.map((it, idx) => (
                  <div key={idx} className="py-2 px-1 flex justify-between text-gray-700">
                    <span>{it.quantity}x {it.product_title}</span>
                    <span className="font-bold">KES {(it.price * it.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Total Bag Value:</span>
                <span className="font-bold text-gray-900">KES {Number(printableOrder.total_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Deposit Amount Paid:</span>
                <span>KES {Number(printableOrder.deposit_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-black text-sm pt-1 border-t border-gray-200">
                <span>Balance to Collect on Delivery:</span>
                <span>KES {Number(printableOrder.balance_due).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Delivery Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintableOrder(null)}
                className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-xs hover:bg-gray-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: PRODUCT CREATE / EDIT */}
      {/* ------------------------------------------------------------- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-base">
                {editingProduct ? 'Edit Product Details' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="e.g. Wireless Bluetooth Speaker"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Price (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="2500"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="15"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Active on Storefront</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Image URL / Link
                </label>
                <input
                  type="url"
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Detailed specifications and highlights..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition shadow-xs"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
