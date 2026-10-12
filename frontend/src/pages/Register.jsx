import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import API from '../api';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { UserPlus, Lock, User, Mail, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const addToCart = useCartStore((state) => state.addToCart);

  const attemptedProduct = location.state?.attemptedProduct;
  const returnTo = location.state?.from || '/';

  const [formData, setFormData] = useState({
    username: '',
    email: '',
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
      const res = await API.post('auth/register/', formData);
      login(res.data.token, res.data.user);

      if (attemptedProduct) {
        addToCart(attemptedProduct);
      }

      navigate(returnTo, { replace: true });
    } catch (err) {
      const errorData = err.response?.data;
      if (typeof errorData === 'object' && errorData !== null) {
        const firstKey = Object.keys(errorData)[0];
        const val = errorData[firstKey];
        setError(Array.isArray(val) ? `${firstKey}: ${val[0]}` : String(val));
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create an Account</h1>
          <p className="text-xs text-gray-500">
            Sign up to start shopping, tracking orders, and quick checkout.
          </p>
        </div>

        {attemptedProduct && (
          <div className="p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-3 text-xs text-amber-800">
            <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sign up to add item to your cart</p>
              <p className="mt-0.5 text-amber-700">
                &ldquo;{attemptedProduct.title}&rdquo; will be added to your cart immediately upon account creation.
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
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Password (min. 6 chars)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link
            to="/login"
            state={{ from: returnTo, attemptedProduct }}
            className="text-sky-600 font-semibold hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
