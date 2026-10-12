import { useEffect, useState, useMemo } from 'react';
import API from '../api';
import ProductCard from '../components/ProductCard';
import { Search, SlidersHorizontal, Sparkles, Filter, X } from 'lucide-react';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [onlyInStock, setOnlyInStock] = useState(false);

  useEffect(() => {
    // Fetch products and categories concurrently
    Promise.all([
      API.get('products/'),
      API.get('categories/'),
    ])
      .then(([productsRes, categoriesRes]) => {
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load store data:', err);
        setLoading(false);
      });
  }, []);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          searchQuery.trim() === '' ||
          p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory =
          selectedCategory === 'all' ||
          String(p.category) === String(selectedCategory) ||
          p.category_name?.toLowerCase() === selectedCategory.toLowerCase();

        const matchesStock = !onlyInStock || (p.stock && p.stock > 0);

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.price) - Number(b.price);
        if (sortBy === 'price-desc') return Number(b.price) - Number(a.price);
        if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        return 0; // featured default
      });
  }, [products, searchQuery, selectedCategory, sortBy, onlyInStock]);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl bg-linear-to-r from-slate-900 via-sky-950 to-slate-900 text-black p-8 md:p-12 overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-600 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Curated Online Store</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Discover Quality Products with Instant M-Pesa &amp; Card Payments
          </h1>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            Browse our handpicked collection, inquire instantly via WhatsApp, and enjoy seamless mobile checkout.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Keyword Search */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title or keyword..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sorting & Stock Toggle */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span>In Stock Only</span>
            </label>

            <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white text-xs font-medium text-gray-700">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent focus:outline-hidden cursor-pointer"
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === String(cat.id)
                  ? 'bg-slate-900 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Featured Products</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading products catalog...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8 space-y-3">
          <Filter className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="font-bold text-gray-800 text-base">No Products Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try adjusting your search keyword or clearing the selected category filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setOnlyInStock(false);
            }}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}