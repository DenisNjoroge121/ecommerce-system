import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ShoppingBag, Store, Info, Shield, User, LogIn, LogOut } from 'lucide-react';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import { useCartStore } from './store/useCartStore';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const cart = useCartStore((state) => state.cart);
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Navigation Bar */}
        <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:text-gray-300 transition">
              <Store className="w-6 h-6 text-sky-400" />
              <span>Belo.Creations</span>
            </Link>

            <nav className="flex items-center gap-3 sm:gap-6">
              <Link to="/" className="text-xs sm:text-sm font-medium hover:text-sky-400 transition">
                Products
              </Link>
              <Link to="/about" className="flex items-center gap-1 text-xs sm:text-sm font-medium hover:text-sky-400 transition">
                <Info className="w-3.5 h-3.5" />
                <span>About</span>
              </Link>

              {/* Admin Panel shortcut */}
              {isAdmin && (
                <Link
                  to="/admin-dashboard"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-400/30 px-2.5 py-1 rounded-full hover:bg-sky-500/20 transition"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Panel</span>
                </Link>
              )}

              {/* Cart Button */}
              <Link to="/checkout" className="relative flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition">
                <ShoppingBag className="w-4 h-4 text-sky-400" />
                <span className="text-xs sm:text-sm font-semibold">Cart</span>
                {cartItemCount > 0 && (
                  <span className="ml-0.5 bg-sky-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                    {cartItemCount}
                  </span>
                )}
              </Link>

              {/* User Account Controls */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                  <span className="hidden md:flex items-center gap-1 text-xs text-slate-300">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    <span>{user?.username}</span>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 transition"
                >
                  <LogIn className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sign In</span>
                </Link>
              )}
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}