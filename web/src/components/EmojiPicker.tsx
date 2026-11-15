import { useState } from 'react';
import { X } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '🤔', '🤫', '🤭', '🥱', '😴', '🤤', '😷', '🤒', '🤕', '🤢', '🤮']
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '💪', '👊', '✊', '🤛', '🤜', ' salute', '🫡']
  },
  {
    name: 'Hearts & Love',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '🔥', '✨', '⭐', '🌟', '💫', '💥', '💯']
  },
  {
    name: 'Celebration',
    emojis: ['🎉', '🎊', '🎈', '🎂', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯', '🚀', '⚡', '🍻', '🥂', '🍾', '🍕', '🍔', '☕', '💡', '🔔']
  }
];

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="absolute bottom-14 right-2 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl w-72 sm:w-80 p-3 select-none animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2 mb-2">
        <div className="flex space-x-1">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              className={`text-xs px-2 py-1 rounded font-medium transition ${
                activeCategory === idx
                  ? 'bg-zena-100 dark:bg-zena-900/60 text-zena-700 dark:text-zena-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto p-1">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
