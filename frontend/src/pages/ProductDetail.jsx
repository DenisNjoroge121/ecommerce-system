import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import API from '../api';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, MessageCircle, ArrowLeft, CheckCircle2, AlertCircle, Plus, Minus, Check } from 'lucide-react';

export default function ProductDetail({ sellerPhone = "254700000000" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const addToCart = useCartStore((state) => state.addToCart);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    API.get(`products/${id}/`)
      .then((res) => {
        setProduct(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="text-center py-20 text-gray-500 font-medium">Loading product details...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-20 space-y-3">
        <h2 className="text-2xl font-bold text-gray-800">Product Not Found</h2>
        <p className="text-sm text-gray-500">The product you are looking for might have been moved or is no longer available.</p>
        <Link to="/" className="text-sky-600 font-semibold hover:underline mt-2 inline-block">
          Return to Catalog
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: location.pathname,
          attemptedProduct: product,
          message: 'Please sign in or create an account to add items to your cart.',
        },
      });
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = `Hi, I'm interested in purchasing "${product.title}" priced at KES ${product.price}. Link: ${window.location.href}`;
    window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const getImageSrc = () => {
    if (imageError || !product.image) {
      return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
    }
    if (product.image.startsWith('http://') || product.image.startsWith('https://')) {
      return product.image;
    }
    const backendBase = 'http://127.0.0.1:8000';
    return product.image.startsWith('/')
      ? `${backendBase}${product.image}`
      : `${backendBase}/${product.image}`;
  };

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  return (
    <div className="max-w-5xl mx-auto py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Product Image */}
        <div className="bg-gray-50 aspect-square relative overflow-hidden flex items-center justify-center p-4">
          <img
            src={getImageSrc()}
            alt={product.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover rounded-xl"
          />

          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-rose-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {product.category_name && (
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                {product.category_name}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {product.title}
            </h1>

            <div className="text-3xl font-black text-sky-600">
              <span className="text-sm font-semibold text-gray-400 mr-1.5">KES</span>
              {Number(product.price).toLocaleString()}
            </div>

            <div className="flex items-center gap-2 text-sm font-medium">
              {!isOutOfStock ? (
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{product.stock} items available in stock</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                  <span>Currently Out of Stock</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                {product.description || 'No detailed description provided for this product.'}
              </p>
            </div>
          </div>

          {/* Quantity Selector & Action Buttons */}
          <div className="space-y-4 pt-6 border-t border-gray-100">
            {!isOutOfStock && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</span>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 hover:bg-gray-100 text-gray-600 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 text-sm font-bold text-gray-800">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock || 99, q + 1))}
                    className="p-2 hover:bg-gray-100 text-gray-600 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition shadow-sm ${
                isOutOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isAdded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Added {quantity > 1 ? `(${quantity})` : ''} to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl text-sm transition shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              Inquire via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}