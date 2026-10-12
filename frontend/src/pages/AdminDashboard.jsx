import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import { useAuthStore } from '../store/useAuthStore';
import {
  Package, ShoppingCart, Smartphone, Plus, Edit2, Trash2,
  DollarSign, Send, X, RefreshCw, ArrowLeft,
  Lock, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Loader2, User
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, isAdmin, isAuthenticated, login } = useAuthStore();

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'orders' | 'stk' | 'account'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Embedded Admin Login State (for direct login on the dashboard)
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  // Modal states
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
  const [passwordStatus, setPasswordStatus] = useState(null); // { type: 'success' | 'error', text: '' }

  // Notification message
  const [bannerMsg, setBannerMsg] = useState(null);

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

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      let isMounted = true;
      Promise.all([
        API.get('products/'),
        API.get('categories/'),
        API.get('orders/'),
      ])
        .then(([prodRes, catRes, ordRes]) => {
          if (isMounted) {
            setProducts(prodRes.data);
            setCategories(catRes.data);
            setOrders(ordRes.data);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Failed to load admin data:', err);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isAuthenticated, isAdmin]);

  const showNotification = (text, type = 'success') => {
    setBannerMsg({ text, type });
    setTimeout(() => setBannerMsg(null), 4000);
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
        setAdminLoginError('This account does not have Administrator privileges. Please ensure "Staff status" is enabled in the Django admin panel.');
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
    } catch (err) {
      console.error('Failed to update order status:', err);
      showNotification('Failed to update status.', 'error');
    }
  };

  const handleTriggerOrderSTK = async (order) => {
    let phone = String(order.customer_phone).trim().replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    else if (!phone.startsWith('254') && phone.length === 9) phone = '254' + phone;

    setStkLoading(true);
    try {
      const res = await API.post('payments/stk-push/', {
        phone_number: phone,
        order_id: order.order_id,
      });
      showNotification(`STK push prompt dispatched to ${phone} for Order ${order.order_id.slice(0, 8)}!`);
      setStkStatus(res.data);
    } catch (err) {
      console.error('Failed to trigger STK push:', err);
      showNotification('STK Push dispatch failed. Check phone format.', 'error');
    } finally {
      setStkLoading(false);
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
              Sign in with the administrator credentials configured by your developer in the Django admin panel.
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

          {/* Developer Guidance Note */}
          <div className="pt-4 border-t border-gray-100 text-center space-y-2">
            <p className="text-[11px] text-gray-400">
              Your login session is automatically persisted in your browser so you will not need to sign in again on this device.
            </p>
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

  // Calculate high-level stats
  const totalRevenue = orders
    .filter((o) => o.status === 'paid')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

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
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAdminData}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-700 transition text-xs flex items-center gap-1.5"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
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

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Total Products</span>
            <Package className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">{products.length}</div>
          <div className="text-[11px] text-gray-400">{categories.length} categories active</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Total Orders</span>
            <ShoppingCart className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">{orders.length}</div>
          <div className="text-[11px] text-amber-600 font-medium">{pendingOrdersCount} pending payment</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Paid Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">KES {totalRevenue.toLocaleString()}</div>
          <div className="text-[11px] text-gray-400">From settled orders</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">M-Pesa STK Gateway</span>
            <Smartphone className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-800">Online</div>
          <div className="text-[11px] text-emerald-600 font-medium">Lipa Na M-Pesa Ready</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 flex gap-6 text-xs font-bold overflow-x-auto pb-0.5">
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
          onClick={() => setActiveTab('orders')}
          className={`pb-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Orders &amp; Payment Status ({orders.length})</span>
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
          <span>Account &amp; Change Password</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PRODUCTS INVENTORY */}
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
      {/* TAB 2: ORDERS & INITIATE STK PUSH */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">M-Pesa Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No customer orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.order_id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {String(o.order_id).slice(0, 8)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{o.customer_name}</div>
                        <div className="text-[11px] text-gray-400">
                          {o.customer_phone} &bull; {o.customer_email}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-gray-900">
                        KES {Number(o.total_amount).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={o.status}
                          onChange={(e) => handleUpdateOrderStatus(o.order_id, e.target.value)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-hidden cursor-pointer ${
                            o.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : o.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : o.status === 'shipped'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="failed">Failed</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-gray-400">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleTriggerOrderSTK(o)}
                          disabled={stkLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-[11px] transition shadow-xs"
                          title="Send M-Pesa STK prompt to customer phone"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Dispatch STK</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: M-PESA STK PUSH LAUNCHER */}
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
                Trigger Lipa Na M-Pesa STK push prompts manually for any phone number and amount.
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
                  Link to Order (Optional)
                </label>
                <select
                  value={stkForm.order_id}
                  onChange={(e) => setStkForm({ ...stkForm, order_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">No specific order (Direct Test Push)</option>
                  {orders.map((o) => (
                    <option key={o.order_id} value={o.order_id}>
                      Order {o.order_id.slice(0, 8)} - KES {o.total_amount} ({o.customer_name})
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

          {/* Response inspector */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-slate-400">Daraja STK Response Monitor</span>
              <span className="text-emerald-400 font-bold">API Status: OK</span>
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
      {/* TAB 4: ACCOUNT SETTINGS & CHANGE PASSWORD */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'account' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-sky-600" />
              <span>Change Store Owner Password</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Update the temporary password given by your developer to secure your store administration.
            </p>
          </div>

          {/* Account Profile Card */}
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

          {/* Status Message */}
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

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 uppercase mb-1">
                Current / Temporary Password
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
      {/* PRODUCT CREATE / EDIT MODAL */}
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
