import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface MediaLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function MediaLightbox({ src, alt, onClose }: MediaLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="absolute top-4 right-4 flex items-center space-x-3 z-10">
        <a
          href={src}
          download={alt || 'image'}
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          title="Download Image"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-4xl max-h-[85vh] rounded-lg overflow-hidden flex items-center justify-center shadow-2xl"
      >
        <img
          src={src}
          alt={alt || 'Full preview'}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
}
