import { MessageCircle } from 'lucide-react';

export default function WhatsAppButton({
  phoneNumber = '254700000000',
  product = null,
  message = '',
  label = 'WhatsApp',
  className = '',
  showIcon = true,
}) {
  const handleClick = (e) => {
    e.stopPropagation();
    let text = message;
    if (!text && product) {
      const currentUrl = typeof window !== 'undefined' ? window.location.origin + `/product/${product.id}` : '';
      text = `Hi, I'm interested in purchasing "${product.title}" priced at KES ${product.price}. ${currentUrl ? `Link: ${currentUrl}` : ''}`;
    } else if (!text) {
      text = 'Hello, I have an inquiry about your products.';
    }

    const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text.trim())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition shadow-sm ${className}`}
      title="Chat on WhatsApp"
    >
      {showIcon && <MessageCircle className="w-4 h-4" />}
      {label && <span>{label}</span>}
    </button>
  );
}
