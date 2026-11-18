import { useEffect, useState, useMemo } from 'react';
import ProductCard from '../components/ProductCard';
import { useCatalogStore } from '../store/useCatalogStore';
import heroImage from '../assets/Hero.jpg';
import { Search, SlidersHorizontal, Sparkles, Filter, X } from 'lucide-react';

export default function Home() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const loading = useCatalogStore((state) => state.loading);
  const loadingMore = useCatalogStore((state) => state.loadingMore);
  const loadCatalog = useCatalogStore((state) => state.loadCatalog);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const subcategories = categories.filter((category) =>
    category.parent && (!selectedCategory || String(category.parent) === selectedCategory)
  );
  const colors = [...new Set(products.map((product) => product.color).filter(Boolean))].sort();

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          searchQuery.trim() === '' ||
          p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.color?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = !selectedCategory || String(p.parent_category) === selectedCategory || (!p.parent_category && String(p.category) === selectedCategory);
        const matchesSubcategory = !selectedSubcategory || String(p.category) === selectedSubcategory;
        const matchesColor = !selectedColor || p.color?.toLowerCase() === selectedColor.toLowerCase();
        const matchesMinPrice = !minPrice || Number(p.price) >= Number(minPrice);
        const matchesMaxPrice = !maxPrice || Number(p.price) <= Number(maxPrice);

        return matchesSearch && matchesCategory && matchesSubcategory && matchesColor && matchesMinPrice && matchesMaxPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.price) - Number(b.price);
        if (sortBy === 'price-desc') return Number(b.price) - Number(a.price);
        if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        return 0; // featured default
      });
  }, [products, searchQuery, sortBy, selectedCategory, selectedSubcategory, selectedColor, minPrice, maxPrice]);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div
        className="relative rounded-3xl bg-cover bg-center text-white p-8 md:p-12 overflow-hidden shadow-sm"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.68) 48%, rgba(15, 23, 42, 0.28) 100%), url(${heroImage})`,
        }}
      >
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-white/60 text-sky-900 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Curated Online Store</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Handcrafted Crochet Bags – Vibrant, Durable, and Made to Last
          </h1>
          <p className="text-white/90 text-sm md:text-base leading-relaxed">
            We specialize in crocheted bags that combine style and durability. Explore our curated collection, chat with us on WhatsApp, and enjoy secure mobile checkout.
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

          {/* Sorting */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubcategory(''); }} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
            <option value="">All categories</option>
            {categories.filter((category) => !category.parent).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} disabled={!subcategories.length} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm disabled:bg-gray-50">
            <option value="">All subcategories</option>
            {subcategories.map((category) => (
              <option key={category.id} value={category.id}>
                {selectedCategory ? category.name : `${category.parent_name} / ${category.name}`}
              </option>
            ))}
          </select>
          <select value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
            <option value="">All colors</option>
            {colors.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
          <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min price (KES)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
          <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max price (KES)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
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
      ) : filteredProducts.length === 0 && !loadingMore ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8 space-y-3">
          <Filter className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="font-bold text-gray-800 text-base">No Products Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try adjusting your search keyword or clearing filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('');
              setSelectedSubcategory('');
              setSelectedColor('');
              setMinPrice('');
              setMaxPrice('');
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
      {loadingMore && <p className="text-center text-xs text-gray-400">Loading more products...</p>}
    </div>
  );
}
