import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Check, Eye } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import WhatsAppButton from './WhatsAppButton';

export default function ProductCard({ product }) {
  const [isAdded, setIsAdded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const addToCart = useCartStore((state) => state.addToCart);

  if (!product) return null;

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  // Resolve image URL
  const getImageSrc = () => {
    if (imageError || !product.image) {
      return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60';
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
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image & Badges */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img
            src={getImageSrc()}
            alt={product.title || 'Product Image'}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Stock Badge */}
        <div className="absolute top-3 left-3">
          {isOutOfStock ? (
            <span className="bg-rose-500/90 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
              Out of Stock
            </span>
          ) : product.stock && product.stock <= 5 ? (
            <span className="bg-amber-500/90 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
              Only {product.stock} left
            </span>
          ) : (
            <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
              In Stock
            </span>
          )}
        </div>

        {/* Quick View Floating Action */}
        <Link
          to={`/product/${product.id}`}
          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </Link>
      </div>

      {/* Product Info */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <Link to={`/product/${product.id}`} className="block group-hover:text-sky-600 transition">
            <h3 className="font-semibold text-gray-900 line-clamp-1 text-base">
              {product.title}
            </h3>
          </Link>
          {product.description && (
            <p className="text-gray-500 text-xs line-clamp-2 mt-1 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Price and Stock Count */}
        <div className="pt-2 border-t border-gray-50">
          <div className="flex items-baseline justify-between">
            <div className="text-lg font-black text-slate-900">
              <span className="text-xs font-semibold text-gray-500 mr-1">KES</span>
              {Number(product.price).toLocaleString()}
            </div>
            {product.stock > 0 && (
              <span className="text-[11px] text-gray-400 font-medium">
                {product.stock} in stock
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition shadow-xs ${
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
              </>
            )}
          </button>

          <WhatsAppButton
            product={product}
            label="Inquire"
            className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200/60"
          />
        </div>
      </div>
    </div>
  );
}
