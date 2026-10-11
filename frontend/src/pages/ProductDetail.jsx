import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api';
import { useCartStore } from '../store/useCartStore';
import { ShoppingCart, MessageCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ProductDetail({ sellerPhone = "254700000000" }) {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const addToCart = useCartStore((state) => state.addToCart);

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
    return <div className="text-center py-16 text-gray-500">Loading product details...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-gray-800">Product Not Found</h2>
        <Link to="/" className="text-sky-600 hover:underline mt-2 inline-block">Return to Catalog</Link>
      </div>
    );
  }

  const handleWhatsApp = () => {
    const text = `Hi, I'm interested in purchasing "${product.title}" priced at KES ${product.price}. Link: ${window.location.href}`;
    window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto py-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Product Image */}
        <div className="bg-gray-50 aspect-square relative">
          <img
            src={product.image || 'https://via.placeholder.com/500'}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Information */}
        <div className="p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
            <div className="text-2xl font-black text-sky-600">
              KES {Number(product.price).toLocaleString()}
            </div>

            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>{product.stock > 0 ? `${product.stock} items in stock` : 'Out of Stock'}</span>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
              {product.description}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-6 border-t border-gray-100 mt-6">
            <button
              onClick={() => addToCart(product)}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-sm"
            >
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </button>

            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition shadow-sm"
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