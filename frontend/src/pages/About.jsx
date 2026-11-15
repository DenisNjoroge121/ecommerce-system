import { useState } from 'react';
import API from '../api';
import { Store, Palette, Heart, ShieldCheck, Send } from 'lucide-react';

export default function About() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await API.post('contact/', formData);
      setSuccessMsg('Your message has been sent successfully! We will get back to you soon.');
      setFormData({ name: '', email: '', message: '' });
    } catch {
      setErrorMsg('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Hero Header */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
        <div className="inline-flex p-3 bg-sky-50 text-sky-600 rounded-xl mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">About Belo Creations</h1>
        <p className="text-gray-500 mt-2 max-w-xl mx-auto">
          We bring crochet creations to your screen, making it easy to explore distinctive handmade pieces and find something that feels like you.
        </p>
      </div>

      {/* What makes the collection special */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Made with crochet</h3>
          <p className="text-sm text-gray-500">Discover crochet bags, hats, clothing, and accessories, each with the character and texture that make crochet special.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">A style for everyday</h3>
          <p className="text-sm text-gray-500">Browse different colors, designs, and product details to choose a piece that suits your style or makes a thoughtful gift.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Simple online shopping</h3>
          <p className="text-sm text-gray-500">View available products, check prices and stock, then place your order online using the checkout options provided.</p>
        </div>
      </div>

      {/* Contact & Inquiry Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900">A little more about the shop</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Belo Creations is an online shop for people who appreciate the color, detail, and versatility of crochet. We showcase each available piece so you can browse at your own pace and choose what works for you.
          </p>
          <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 text-sm">Need help choosing?</h4>
            <p className="text-sm text-gray-600 mt-1">Ask us about a product, its color or availability, or send a request about an item you have in mind.</p>
          </div>
        </div>

        {/* Inquiry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Send an Inquiry</h3>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Your Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Message</label>
            <textarea
              required
              rows="4"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none text-sm resize-none"
              placeholder="How can we help you?"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Sending...' : 'Send Message'}
          </button>

          {successMsg && <p className="text-emerald-600 text-xs font-medium mt-2">{successMsg}</p>}
          {errorMsg && <p className="text-red-500 text-xs font-medium mt-2">{errorMsg}</p>}
        </form>
      </div>
    </div>
  );
}
