import { useState } from 'react';
import { X, UserX, Settings, Check } from 'lucide-react';
import { apiFetch } from '../api';

interface GroupSettingsModalProps {
  conversation: any;
  currentUserId: string;
  onUpdateConversation: (updated: any) => void;
  onClose: () => void;
}

export default function GroupSettingsModal({
  conversation,
  currentUserId,
  onUpdateConversation,
  onClose,
}: GroupSettingsModalProps) {
  const [name, setName] = useState(conversation.name || '');
  const [description, setDescription] = useState(conversation.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isCreator =
    conversation.createdBy === currentUserId ||
    (conversation.createdBy && conversation.createdBy._id === currentUserId) ||
    conversation.name !== 'General Chat'; // Allow moderation for group chats

  const isGeneralChat = conversation.name === 'General Chat';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeneralChat) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiFetch(`/api/v1/conversations/${conversation._id}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ name, description }),
      });
      if (res) {
        onUpdateConversation(res);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update group settings');
    } finally {
      setLoading(false);
    }
  };

  const handleKickParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`Are you sure you want to remove ${participantName} from this group?`)) return;

    try {
      const res = await apiFetch(`/api/v1/conversations/${conversation._id}/kick/${participantId}`, {
        method: 'POST',
      });
      if (res) {
        onUpdateConversation(res);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative"
      >
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-zena-600" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">Group Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-xs">
              {error}
            </div>
          )}
          {success && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-1.5 font-medium">
              <Check className="w-4 h-4" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {/* Group Info Form */}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Room Name
              </label>
              <input
                type="text"
                disabled={isGeneralChat}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Room Description / Topic
              </label>
              <textarea
                rows={2}
                disabled={isGeneralChat}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group about?"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            {!isGeneralChat && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 bg-zena-600 hover:bg-zena-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}
          </form>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Members ({conversation.participants?.length || 0})
              </h4>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {conversation.participants?.map((p: any) => {
                const pId = typeof p === 'object' && p ? p._id : p;
                const pName =
                  (typeof p === 'object' ? p.displayName || p.username || p.name : null) || 'Member';
                const pUsername = typeof p === 'object' ? p.username : null;
                const isOnline = typeof p === 'object' ? p.isOnline : false;
                const isSelf = pId === currentUserId;

                return (
                  <div
                    key={pId}
                    className="p-2.5 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-zena-600 text-white flex items-center justify-center font-bold text-xs">
                          {pName[0]?.toUpperCase()}
                        </div>
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate flex items-center gap-1">
                          <span>{pName}</span>
                          {isSelf && (
                            <span className="text-[10px] text-gray-400 font-normal">(You)</span>
                          )}
                        </p>
                        {pUsername && (
                          <p className="text-[10px] text-gray-400">@{pUsername}</p>
                        )}
                      </div>
                    </div>

                    {!isSelf && !isGeneralChat && isCreator && (
                      <button
                        onClick={() => handleKickParticipant(pId, pName)}
                        title="Remove member"
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded transition"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
