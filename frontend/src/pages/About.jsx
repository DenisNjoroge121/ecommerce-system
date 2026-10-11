import React from 'react';
import { Store, MapPin, Mail, Phone, ShieldCheck, Clock } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Hero Header */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
        <div className="inline-flex p-3 bg-sky-50 text-sky-600 rounded-xl mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">About Our Store</h1>
        <p className="text-gray-500 mt-2 max-w-xl mx-auto">
          We provide high-quality products with secure mobile payments and instant communication options to make your shopping experience seamless.
        </p>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Secure Payments</h3>
          <p className="text-sm text-gray-500">Pay safely using Lipa Na M-Pesa STK push or major credit/debit cards instantly.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Fast Order Processing</h3>
          <p className="text-sm text-gray-500">Orders are confirmed in real-time as soon as your payment transaction is verified.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Physical Location</h3>
          <p className="text-sm text-gray-500">Visit our store or reach out online for inquiries, custom orders, and customer support.</p>
        </div>
      </div>

      {/* Contact & Location Details */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Get in Touch</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-sky-600 shrink-0" />
            <span>Nairobi, Kenya</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>+254 700 000 000</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-sky-600 shrink-0" />
            <span>support@devstore.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}