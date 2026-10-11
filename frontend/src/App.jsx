import React from 'react'


export default function App(){
  const cart = useCartStore((state)=> state.cart);
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  
  return(
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Navigaton Bar */}
        <header className='bg-slate-900 text-white sticky top-0 z-50 shadow-md'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
            <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:text-gray-300 transition">
              <Store className="w-6 h-6 text-sky-400" />
              <span>DevStore</span>
            </Link>

            <nav className='flex items-center gap-6'>
              <Link to="/" className="text-sm font-medium hover:text-sky-400 transition">
                Products
              </Link>

              <Link to="/about" className="flex items-center gap-1 text-sm font-medium hover:text-sky-400 transition">
                <Info className="w-4 h-4"/>
                <span>About</span>
              </Link>

              <Link to="/checkout" className="relative flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-full border border-slate-700 transition">
                <ShoppingBag className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold">Cart</span>
                {cartItemCount > 0 && (
                  <span className='ml-1 bg-sky-500 text-slate-950 font-bold text-xs px-2 py-0.5 rounded-full'>
                    {cartItemCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className='flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/about" element={<About />} />
                <Route path="/checkout" element={<Checkout />} />
          </Routes>

        </main>
      </div>
    </Router>
  );
  
}