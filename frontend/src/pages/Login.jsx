import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import API from '../api';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { LogIn, Lock, User, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const addToCart = useCartStore((state) => state.addToCart);

  const attemptedProduct = location.state?.attemptedProduct;
  const promptMessage = location.state?.message;
  const returnTo = location.state?.from || '/';

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await API.post('auth/login/', formData);
      login(res.data.token, res.data.user);

      // If customer attempted to add a product before signing in, fulfill it now!
      if (attemptedProduct) {
        addToCart(attemptedProduct);
      }

      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to sign in. Please check your username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = () => {
    setFormData({ username: 'admin', password: 'admin123' });
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center mx-auto">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign In to Your Account</h1>
          <p className="text-xs text-gray-500">
            Access your shopping cart, orders, and personalized checkout.
          </p>
        </div>

        {/* If redirected from cart click */}
        {attemptedProduct && (
          <div className="p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-3 text-xs text-amber-800">
            <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{promptMessage || 'Sign in to add this item to your cart'}</p>
              <p className="mt-0.5 text-amber-700">
                &ldquo;{attemptedProduct.title}&rdquo; will be added to your cart automatically once you sign in.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username or email"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo fill */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleQuickAdminLogin}
            className="text-xs text-sky-600 hover:text-sky-700 underline font-medium"
          >
            Fill Demo Admin Credentials (admin / admin123)
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
          Don&apos;t have an account yet?{' '}
          <Link
            to="/register"
            state={{ from: returnTo, attemptedProduct }}
            className="text-sky-600 font-semibold hover:underline"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
