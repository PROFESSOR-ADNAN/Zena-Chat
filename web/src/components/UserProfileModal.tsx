import { useState } from 'react';
import { X, Shield, ShieldAlert, Edit3, Calendar } from 'lucide-react';
import { apiFetch } from '../api';

interface UserProfileModalProps {
  user: any;
  currentUserId: string;
  isBlocked?: boolean;
  onUpdateCurrentUser?: (updated: any) => void;
  onToggleBlock?: (targetUserId: string, block: boolean) => void;
  onClose: () => void;
}

export default function UserProfileModal({
  user,
  currentUserId,
  isBlocked = false,
  onUpdateCurrentUser,
  onToggleBlock,
  onClose,
}: UserProfileModalProps) {
  const isMe = user._id === currentUserId;
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [statusText, setStatusText] = useState(user.statusText || 'Available');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/v1/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ displayName, bio, statusText }),
      });
      if (res) {
        onUpdateCurrentUser?.(res);
        setIsEditing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Profile Header Gradient */}
        <div className="h-24 bg-gradient-to-r from-zena-700 via-emerald-600 to-teal-500 relative">
          <div className="absolute -bottom-8 left-6">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 p-1 shadow-lg flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-zena-600 text-white font-bold text-xl flex items-center justify-center">
                {displayName[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="pt-10 px-6 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                {displayName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
            </div>

            {isMe && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 flex items-center gap-1 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
          </div>

          {error && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded text-xs">
              {error}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSave} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="e.g. Available, In a meeting..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Bio
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a short bio about yourself..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 text-xs bg-zena-600 text-white rounded font-medium hover:bg-zena-700 transition"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 space-y-3">
              {/* Status pill */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-700 dark:text-gray-300 italic">
                  "{statusText || 'Online'}"
                </span>
              </div>

              {/* Bio */}
              <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  About
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {bio || 'No bio provided.'}
                </p>
              </div>

              {/* Details */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {memberSince}</span>
              </div>

              {/* Action buttons if viewing someone else */}
              {!isMe && onToggleBlock && (
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => onToggleBlock(user._id, !isBlocked)}
                    className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      isBlocked
                        ? 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200'
                        : 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300'
                    }`}
                  >
                    {isBlocked ? (
                      <>
                        <Shield className="w-3.5 h-3.5" />
                        <span>Unblock User</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Block User</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
