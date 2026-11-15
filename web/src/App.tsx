import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Send,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Check,
  CheckCheck,
  AlertTriangle,
  Globe,
  MessageSquare,
  LogOut,
  User,
  Plus,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  X,
  Bell,
  ChevronDown,
  Smile,
  Paperclip,
  Mic,
  Search,
  Pin,
  PinOff,
  Download,
  Settings,
  FileText,
  Activity,
  Sun,
  Moon,
  CornerUpLeft,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import LandingPage from './LandingPage';
import { db, LocalMessage } from './db';
import { syncEngine, ConnectionState } from './sync/engine';
import { apiFetch } from './api';

import EmojiPicker from './components/EmojiPicker';
import AudioRecorder from './components/AudioRecorder';
import AudioPlayer from './components/AudioPlayer';
import MediaLightbox from './components/MediaLightbox';
import UserProfileModal from './components/UserProfileModal';
import GroupSettingsModal from './components/GroupSettingsModal';
import SoundSettingsModal, { playCustomChime } from './components/SoundSettingsModal';
import SystemStatusModal from './components/SystemStatusModal';

interface UserData {
  _id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  bio?: string;
  statusText?: string;
  blockedUsers?: string[];
  createdAt?: string;
}

interface ConversationItem {
  _id: string;
  type: 'dm' | 'group';
  name?: string;
  description?: string;
  pinnedMessage?: {
    messageId?: string;
    text?: string;
    senderName?: string;
    pinnedAt?: string;
    pinnedBy?: string;
  };
  unreadCount?: number;
  lastReadSeq?: number;
  lastMessageAt?: string;
  lastMessage?: {
    text?: string;
    sender?: {
      _id?: string;
      displayName?: string;
      username?: string;
      name?: string;
    };
    sentAt?: string;
  };
  participants: Array<{
    _id: string;
    username?: string;
    displayName?: string;
    name?: string;
    isOnline?: boolean;
    bio?: string;
    statusText?: string;
  }>;
  createdBy?: string | { _id: string };
}

interface NotificationToast {
  id: string;
  conversationId: string;
  senderName: string;
  conversationTitle: string;
  text: string;
}

function formatTelegramTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [currentUser, setCurrentUser] = useState<UserData | null>(() => {
    try {
      const saved = localStorage.getItem('zena_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Dark / Light Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('zena_theme') as 'dark' | 'light') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('zena_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLandingForUser, setShowLandingForUser] = useState(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [inputText, setInputText] = useState('');

  // Modals & Popovers
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);

  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const [dmLoading, setDmLoading] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [viewingProfileUser, setViewingProfileUser] = useState<any | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Reply & Quote
  const [replyingTo, setReplyingTo] = useState<LocalMessage | null>(null);

  // Typing state
  const [typingUsers, setTypingUsers] = useState<
    Record<string, { username: string; displayName?: string }>
  >({});
  const typingTimerRef = useRef<Record<string, any>>({});
  const myTypingTimerRef = useRef<any>(null);

  // PWA Install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeletingConv, setIsDeletingConv] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeToast, setActiveToast] = useState<NotificationToast | null>(null);

  // Telegram-style unread separation and smart scrolling
  const [readBoundaryMap, setReadBoundaryMap] = useState<Record<string, number | null>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesContainerRef = useRef<HTMLElement>(null);
  const unreadSeparatorRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeConvIdRef = useRef(activeConversationId);
  const positionedConvIdRef = useRef<string | null>(null);
  const isLoadingOlderRef = useRef(false);

  // Scroll memory per conversation
  const scrollPosMapRef = useRef<Record<string, number>>({});
  const wasNearBottomMapRef = useRef<Record<string, boolean>>({});

  const lastMarkReadSeqRef = useRef<Record<string, number>>({});
  const markReadTimerRef = useRef<any>(null);

  // Listen to PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const throttledMarkAsRead = (convId: string, seq: number) => {
    if (lastMarkReadSeqRef.current[convId] === seq) return;
    lastMarkReadSeqRef.current[convId] = seq;

    if (markReadTimerRef.current) {
      clearTimeout(markReadTimerRef.current);
    }

    markReadTimerRef.current = setTimeout(() => {
      syncEngine.markAsRead(convId, seq);
    }, 100);
  };

  const updateVisibleReadProgress = () => {
    const container = messagesContainerRef.current;
    if (!container || !activeConversationId || !messages || messages.length === 0) return;

    const viewportBottom = container.scrollTop + container.clientHeight;
    const isNearBottom = container.scrollHeight - viewportBottom < 60;

    const currentConv = conversations.find((c) => String(c._id) === String(activeConversationId));
    const prevReadSeq = currentConv?.lastReadSeq ?? readBoundaryMap[activeConversationId] ?? 0;

    let maxSeenSeq = prevReadSeq;

    if (isNearBottom) {
      const highestSeq = Math.max(...messages.map((m) => m.seq || 0));
      if (highestSeq > maxSeenSeq) {
        maxSeenSeq = highestSeq;
      }
    } else {
      const messageElements = container.querySelectorAll<HTMLElement>('.message-item[data-seq]');
      messageElements.forEach((el) => {
        if (el.offsetTop <= viewportBottom - 8) {
          const seq = Number(el.dataset.seq);
          if (!isNaN(seq) && seq > maxSeenSeq) {
            maxSeenSeq = seq;
          }
        }
      });
    }

    if (maxSeenSeq > prevReadSeq) {
      const remainingUnread = isNearBottom
        ? 0
        : messages.filter(
            (m) =>
              typeof m.seq === 'number' &&
              m.seq > maxSeenSeq &&
              m.senderId !== currentUser?._id &&
              m.senderId !== 'self'
          ).length;

      setUnreadCounts((prev) => ({
        ...prev,
        [activeConversationId]: remainingUnread,
      }));

      setConversations((prev) =>
        prev.map((c) => {
          if (String(c._id) === String(activeConversationId)) {
            return {
              ...c,
              lastReadSeq: maxSeenSeq,
              unreadCount: remainingUnread,
            };
          }
          return c;
        })
      );

      throttledMarkAsRead(activeConversationId, maxSeenSeq);
    }
  };

  useEffect(() => {
    activeConvIdRef.current = activeConversationId;
    positionedConvIdRef.current = null;
    setShowScrollBottom(false);
    setReplyingTo(null);
    setSearchQuery('');
  }, [activeConversationId]);

  const selectConversation = (convId: string) => {
    if (!convId) return;

    if (activeConversationId && lastMarkReadSeqRef.current[activeConversationId]) {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      syncEngine.markAsRead(activeConversationId, lastMarkReadSeqRef.current[activeConversationId]);
    }

    if (activeConversationId && messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      scrollPosMapRef.current[activeConversationId] = scrollTop;
      wasNearBottomMapRef.current[activeConversationId] = scrollHeight - scrollTop - clientHeight < 60;
    }

    positionedConvIdRef.current = null;
    setShowScrollBottom(false);
    setReplyingTo(null);
    setSearchQuery('');

    const conv = conversations.find((c) => String(c._id) === String(convId));
    const currentUnread =
      unreadCounts[convId] !== undefined ? unreadCounts[convId] : (conv?.unreadCount ?? 0);
    const hasUnread = currentUnread > 0;
    const boundary = hasUnread ? (conv?.lastReadSeq ?? 0) : null;
    setReadBoundaryMap((prev) => ({ ...prev, [convId]: boundary }));

    setActiveConversationId(convId);
    fetchHistory(convId);
    syncEngine.joinConversation(convId);
  };

  const handleScroll = async (e: React.UIEvent<HTMLElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 60;

    if (activeConversationId) {
      scrollPosMapRef.current[activeConversationId] = scrollTop;
      wasNearBottomMapRef.current[activeConversationId] = nearBottom;
    }

    setShowScrollBottom(!nearBottom);
    updateVisibleReadProgress();

    // Feature 12: Infinite Scroll for Message History
    if (
      scrollTop < 30 &&
      !isLoadingOlderRef.current &&
      activeConversationId &&
      messages &&
      messages.length >= 15
    ) {
      const oldestSeq = messages[0]?.seq;
      if (oldestSeq && oldestSeq > 1) {
        isLoadingOlderRef.current = true;
        try {
          const oldScrollHeight = container.scrollHeight;
          const res = await apiFetch(
            `/api/v1/conversations/${activeConversationId}/messages?before=${oldestSeq}&limit=40`
          );
          const older = Array.isArray(res) ? res : res?.messages || [];
          if (older.length > 0) {
            const msgsToPut: LocalMessage[] = older.map((m: any) => ({
              id: m._id,
              conversationId: activeConversationId,
              seq: m.seq,
              eventSeq: m.eventSeq,
              senderId:
                typeof m.senderId === 'object' && m.senderId?._id
                  ? String(m.senderId._id)
                  : String(m.senderId || 'other'),
              senderName:
                m.senderDisplayName ||
                m.senderUsername ||
                (typeof m.senderId === 'object' ? m.senderId.displayName : undefined),
              clientMsgId: m.clientMsgId || m._id,
              text: m.text || '',
              type: m.type || 'text',
              mediaUrl: m.mediaUrl,
              fileName: m.fileName,
              fileSize: m.fileSize,
              replyTo: m.replyTo,
              reactions: m.reactions || [],
              status: 'delivered' as const,
              createdAt: m.createdAt,
              editedAt: m.editedAt,
            }));

            await db.messages.bulkPut(msgsToPut);

            requestAnimationFrame(() => {
              if (messagesContainerRef.current) {
                const diff = messagesContainerRef.current.scrollHeight - oldScrollHeight;
                messagesContainerRef.current.scrollTop = scrollTop + diff;
              }
            });
          }
        } catch (err) {
          console.warn('Could not load older history:', err);
        } finally {
          setTimeout(() => {
            isLoadingOlderRef.current = false;
          }, 800);
        }
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    if (activeConversationId) {
      wasNearBottomMapRef.current[activeConversationId] = true;
      setUnreadCounts((prev) => ({ ...prev, [activeConversationId]: 0 }));
      const highestSeq =
        messages && messages.length > 0 ? Math.max(...messages.map((m) => m.seq || 0)) : 0;
      if (highestSeq > 0) {
        setConversations((prev) =>
          prev.map((c) =>
            String(c._id) === String(activeConversationId)
              ? { ...c, lastReadSeq: highestSeq, unreadCount: 0 }
              : c
          )
        );
        syncEngine.markAsRead(activeConversationId, highestSeq);
      }
    }
  };

  // Unlock Web Audio
  useEffect(() => {
    const unlock = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          ctx.resume().catch(() => {});
        }
      } catch {}
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Toast Auto-dismiss
  useEffect(() => {
    if (!activeToast) return;
    const t = setTimeout(() => setActiveToast(null), 5000);
    return () => clearTimeout(t);
  }, [activeToast]);

  // Web Push / Desktop Notification Permission
  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [currentUser]);

  // Dynamic Title with unread count
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + (n || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Zena Chat`;
    } else {
      document.title = 'Zena Chat';
    }
  }, [unreadCounts]);

  // Reactive Messages Query
  const messages = useLiveQuery<LocalMessage[]>(
    async () => {
      if (!activeConversationId) return [];
      const raw = await db.messages
        .where('conversationId')
        .equals(activeConversationId)
        .sortBy('createdAt');

      const seen = new Set<string>();
      const deduped: LocalMessage[] = [];
      for (const m of raw) {
        const key = m.clientMsgId || m.id;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(m);
        }
      }
      return deduped;
    },
    [activeConversationId]
  );

  const pendingOutboxCount = useLiveQuery(() => db.outbox.count()) || 0;

  // Socket event listeners
  useEffect(() => {
    const unsubConv = syncEngine.onConversationNew((newConv) => {
      if (currentUser && newConv.participants) {
        const isParticipant = newConv.participants.some((p: any) => {
          const id = typeof p === 'object' && p ? p._id : p;
          return id === currentUser._id;
        });
        if (!isParticipant && newConv.name !== 'General Chat') {
          return;
        }
      }
      setConversations((prev) => {
        if (prev.some((c) => c._id === newConv._id)) return prev;
        return [newConv, ...prev];
      });
    });

    const unsubConvDel = syncEngine.onConversationDelete(({ conversationId }) => {
      setConversations((prev) => {
        const remaining = prev.filter((c) => c._id !== conversationId);
        setActiveConversationId((current) => {
          if (current === conversationId) {
            return remaining.length > 0 ? remaining[0]._id : '';
          }
          return current;
        });
        return remaining;
      });
    });

    const unsubConvUpd = syncEngine.onConversationUpdate((updatedConv) => {
      setConversations((prev) =>
        prev.map((c) => (c._id === updatedConv._id ? { ...c, ...updatedConv } : c))
      );
    });

    const unsubPresence = syncEngine.onPresenceUpdate(({ userId, isOnline }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (!c.participants) return c;
          const hasUser = c.participants.some((p: any) => (p._id || p) === userId);
          if (!hasUser) return c;
          return {
            ...c,
            participants: c.participants.map((p: any) =>
              (p._id || p) === userId ? { ...p, isOnline } : p
            ),
          };
        })
      );
    });

    // Feature 1: Typing indicator listener
    const unsubTyping = syncEngine.onTyping(
      ({ conversationId, userId, username, displayName, isTyping }) => {
        if (userId === currentUser?._id) return;
        if (isTyping) {
          setTypingUsers((prev) => ({
            ...prev,
            [conversationId]: { username, displayName },
          }));
          if (typingTimerRef.current[conversationId]) {
            clearTimeout(typingTimerRef.current[conversationId]);
          }
          typingTimerRef.current[conversationId] = setTimeout(() => {
            setTypingUsers((prev) => {
              const copy = { ...prev };
              delete copy[conversationId];
              return copy;
            });
          }, 3500);
        } else {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[conversationId];
            return copy;
          });
        }
      }
    );

    // Feature 2: Reaction listener
    const unsubReaction = syncEngine.onMessageReaction(
      async ({ messageId, reactions }) => {
        await db.messages.update(messageId, { reactions });
      }
    );

    // Feature 6: Pin listener
    const unsubPin = syncEngine.onConversationPinned(({ conversationId, pinnedMessage }) => {
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, pinnedMessage } : c))
      );
    });

    const unsubMsg = syncEngine.onMessageNew((newMsg) => {
      const convId = String(newMsg.conversationId);
      const isFromMe =
        String(newMsg.senderId?._id || newMsg.senderId) === String(currentUser?._id) ||
        newMsg.senderUsername === currentUser?.username;

      setConversations((prev) => {
        const index = prev.findIndex((c) => String(c._id) === convId);
        if (index === -1) {
          loadConversations();
          return prev;
        }

        const updated = [...prev];
        const target = { ...updated[index] };
        target.lastMessage = {
          text: newMsg.text || (newMsg.type === 'image' ? '[Photo]' : newMsg.type === 'audio' ? '[Voice Note]' : '[Attachment]'),
          sender: {
            _id: newMsg.senderId?._id || newMsg.senderId,
            displayName: newMsg.senderDisplayName || newMsg.senderUsername,
            username: newMsg.senderUsername,
          },
          sentAt: newMsg.createdAt,
        };
        target.lastMessageAt = newMsg.createdAt;

        const without = updated.filter((c) => String(c._id) !== convId);
        if (target.name?.toLowerCase().trim() === 'general chat') {
          return [target, ...without];
        } else {
          const generalIdx = without.findIndex((c) => c.name?.toLowerCase().trim() === 'general chat');
          if (generalIdx >= 0) {
            const general = without[generalIdx];
            const others = without.filter((_, i) => i !== generalIdx);
            return [general, target, ...others];
          }
          return [target, ...without];
        }
      });

      const isCurrentlyViewing =
        convId === String(activeConvIdRef.current) && document.visibilityState === 'visible';
      const isScrolledUp = isCurrentlyViewing && !wasNearBottomMapRef.current[convId];

      if (!isFromMe && (!isCurrentlyViewing || isScrolledUp)) {
        setUnreadCounts((prev) => ({
          ...prev,
          [convId]: (prev[convId] || 0) + 1,
        }));
      } else if (!isFromMe && isCurrentlyViewing && !isScrolledUp) {
        if (newMsg.seq) {
          syncEngine.markAsRead(convId, newMsg.seq);
        }
      }

      if (!isFromMe) {
        // Feature 13: Custom chime sound
        const soundEnabled = localStorage.getItem('zena_sound') !== 'false';
        const soundVolume = Number(localStorage.getItem('zena_volume') || '0.5');
        const soundChime = localStorage.getItem('zena_chime') || 'default';
        if (soundEnabled) {
          playCustomChime(soundChime, soundVolume);
        }

        setConversations((currentConvs) => {
          const conv = currentConvs.find((c) => String(c._id) === convId);
          const title = conv?.name || newMsg.senderDisplayName || newMsg.senderUsername || 'New Message';
          setActiveToast({
            id: newMsg._id || crypto.randomUUID(),
            conversationId: convId,
            senderName: newMsg.senderDisplayName || newMsg.senderUsername || 'Someone',
            conversationTitle: title,
            text: newMsg.text || 'Sent an attachment',
          });
          return currentConvs;
        });

        // Feature 16: Browser desktop notification
        if (
          'Notification' in window &&
          Notification.permission === 'granted' &&
          document.visibilityState !== 'visible'
        ) {
          try {
            new Notification(`${newMsg.senderDisplayName || newMsg.senderUsername || 'Zena Chat'}`, {
              body: newMsg.text || 'New message received',
              icon: '/vite.svg',
            });
          } catch {}
        }
      }
    });

    return () => {
      unsubConv();
      unsubConvUpd();
      unsubPresence();
      unsubConvDel();
      unsubTyping();
      unsubReaction();
      unsubPin();
      unsubMsg();
    };
  }, []);

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem('zena_token');
    if (token && currentUser) {
      syncEngine.init(token);
      loadConversations();
    } else {
      syncEngine.disconnect();
    }

    const unsubscribe = syncEngine.onStateChange((state) => {
      setConnectionState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Fetch recent messages
  const fetchHistory = async (convId: string) => {
    if (!convId) return;
    try {
      const data = await apiFetch(`/api/v1/conversations/${convId}/messages?limit=100`);

      if (data?.lastReadSeq !== undefined) {
        setReadBoundaryMap((prev) => {
          const conv = conversations.find((c) => String(c._id) === String(convId));
          const currentUnread =
            unreadCounts[convId] !== undefined ? unreadCounts[convId] : (conv?.unreadCount ?? 0);
          if (currentUnread <= 0) return { ...prev, [convId]: null };
          const boundary = Math.max(prev[convId] ?? 0, data.lastReadSeq ?? 0);
          return { ...prev, [convId]: boundary };
        });
      }

      const hist = Array.isArray(data)
        ? data
        : Array.isArray(data?.messages)
        ? data.messages
        : [];

      if (hist.length > 0) {
        const currentUserId = currentUser?._id;
        const messagesToPut: LocalMessage[] = [];

        for (const m of hist) {
          const sId =
            typeof m.senderId === 'object' && m.senderId?._id
              ? String(m.senderId._id)
              : String(m.senderId || m.sender?._id || m.sender || '');
          const sName =
            typeof m.senderId === 'object'
              ? m.senderId.displayName || m.senderId.username
              : m.sender?.displayName || m.sender?.username || m.senderName;

          if (m.clientMsgId) {
            const local = await db.messages.where('clientMsgId').equals(m.clientMsgId).first();
            if (local && local.id !== m._id) {
              await db.messages.delete(local.id);
            }
          }

          const isMe = sId === String(currentUserId);
          messagesToPut.push({
            id: m._id,
            conversationId: convId,
            seq: m.seq,
            eventSeq: m.eventSeq,
            senderId: sId,
            senderName: sName,
            clientMsgId: m.clientMsgId || m._id,
            text: m.text || '',
            type: m.type || 'text',
            mediaUrl: m.mediaUrl,
            fileName: m.fileName,
            fileSize: m.fileSize,
            replyTo: m.replyTo,
            reactions: m.reactions || [],
            status: isMe ? 'sent' : 'delivered',
            createdAt:
              typeof m.createdAt === 'string'
                ? m.createdAt
                : m.createdAt
                ? new Date(m.createdAt).toISOString()
                : new Date().toISOString(),
            editedAt: m.editedAt
              ? typeof m.editedAt === 'string'
                ? m.editedAt
                : new Date(m.editedAt).toISOString()
              : undefined,
          });
        }

        if (messagesToPut.length > 0) {
          await db.messages.bulkPut(messagesToPut);
        }
      }
    } catch (e: any) {
      console.warn('Could not load history for conversation:', e.message);
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      syncEngine.joinConversation(activeConversationId);
      fetchHistory(activeConversationId);
    }
  }, [activeConversationId, connectionState]);

  // Smart scrolling (Telegram-style)
  useEffect(() => {
    if (!messages || messages.length === 0 || !activeConversationId) return;

    if (positionedConvIdRef.current === activeConversationId) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) return;

    const boundary = readBoundaryMap[activeConversationId];
    const unreadNum = unreadCounts[activeConversationId] ?? 0;
    const hasUnread = (boundary !== null && boundary !== undefined) || unreadNum > 0;

    if (hasUnread) {
      let firstUnreadIdx = messages.findIndex(
        (m) =>
          typeof m.seq === 'number' &&
          boundary !== null &&
          boundary !== undefined &&
          m.seq > boundary &&
          m.senderId !== currentUser?._id &&
          m.senderId !== 'self'
      );

      if (firstUnreadIdx === -1 && unreadNum > 0) {
        const otherMessages = messages.filter(
          (m) => m.senderId !== currentUser?._id && m.senderId !== 'self'
        );
        if (otherMessages.length > 0) {
          const targetMsg = otherMessages[Math.max(0, otherMessages.length - unreadNum)];
          firstUnreadIdx = messages.findIndex((m) => m.id === targetMsg?.id);
        }
      }

      if (firstUnreadIdx >= 0) {
        if (unreadSeparatorRef.current) {
          const separator = unreadSeparatorRef.current;
          const targetScroll = Math.max(0, separator.offsetTop - container.offsetTop - 12);
          container.scrollTop = targetScroll;
          positionedConvIdRef.current = activeConversationId;
          setShowScrollBottom(true);

          requestAnimationFrame(() => {
            if (unreadSeparatorRef.current && messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = Math.max(
                0,
                unreadSeparatorRef.current.offsetTop - messagesContainerRef.current.offsetTop - 12
              );
            }
            setTimeout(() => {
              updateVisibleReadProgress();
            }, 50);
          });
          return;
        }
        return;
      }
    }

    const savedPos = scrollPosMapRef.current[activeConversationId];
    const wasNearBottom = wasNearBottomMapRef.current[activeConversationId];

    if (typeof savedPos === 'number' && !wasNearBottom) {
      container.scrollTop = savedPos;
      positionedConvIdRef.current = activeConversationId;
      setShowScrollBottom(true);

      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = savedPos;
        }
      });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    container.scrollTop = container.scrollHeight;
    positionedConvIdRef.current = activeConversationId;
    setShowScrollBottom(false);

    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  }, [messages, activeConversationId, readBoundaryMap, currentUser?._id, unreadCounts]);

  const loadConversations = async () => {
    try {
      const data = await apiFetch('/api/v1/conversations');
      const list = Array.isArray(data) ? data : [];
      setConversations(list);

      if (list.length > 0) {
        const serverCounts: Record<string, number> = {};
        const boundaries: Record<string, number | null> = {};
        for (const c of list) {
          serverCounts[c._id] = c.unreadCount || 0;
          if ((c.unreadCount || 0) > 0) {
            boundaries[c._id] = c.lastReadSeq ?? 0;
          } else {
            boundaries[c._id] = null;
          }
        }
        setReadBoundaryMap((prev) => ({ ...boundaries, ...prev }));

        const currentActive = activeConvIdRef.current;
        const nextId =
          currentActive && list.some((c: ConversationItem) => c._id === currentActive)
            ? currentActive
            : list[0]._id;

        const activeConv = list.find((c: ConversationItem) => c._id === nextId);
        const hasUnread = (activeConv?.unreadCount ?? 0) > 0;
        const boundary = hasUnread ? (activeConv?.lastReadSeq ?? 0) : null;
        setReadBoundaryMap((prev) => ({ ...boundaries, ...prev, [nextId]: boundary }));

        positionedConvIdRef.current = null;
        setActiveConversationId(nextId);
        fetchHistory(nextId);

        setUnreadCounts((prev) => ({ ...serverCounts, ...prev }));
      }
    } catch (err: any) {
      console.warn('Could not load conversations:', err.message);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const body =
        authMode === 'login'
          ? { login: authForm.email || authForm.username, password: authForm.password }
          : {
              username: authForm.username.toLowerCase(),
              displayName: authForm.displayName || authForm.username,
              name: authForm.displayName || authForm.username,
              email: authForm.email,
              password: authForm.password,
            };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.token) {
        localStorage.setItem('zena_token', res.token);
        localStorage.setItem('zena_user', JSON.stringify(res));
        setCurrentUser(res);
        setShowAuthModal(false);
        setShowLandingForUser(false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const demoEmail = 'demo@zena.chat';
    const demoPassword = 'Password123!';

    try {
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: demoEmail, password: demoPassword }),
      }).catch(async () => {
        return await apiFetch('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: `guest_${Math.floor(Math.random() * 9000 + 1000)}`,
            displayName: 'Guest User',
            email: `guest_${Date.now()}@zena.chat`,
            password: demoPassword,
          }),
        });
      });

      if (res.token) {
        localStorage.setItem('zena_token', res.token);
        localStorage.setItem('zena_user', JSON.stringify(res));
        setCurrentUser(res);
        setShowAuthModal(false);
        setShowLandingForUser(false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Demo login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zena_token');
    localStorage.removeItem('zena_user');
    setCurrentUser(null);
    setShowLandingForUser(false);
    setShowAuthModal(false);
    syncEngine.disconnect();
  };

  // Feature 1: Live typing notification on input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (activeConversationId) {
      syncEngine.startTyping(activeConversationId);
      if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
      myTypingTimerRef.current = setTimeout(() => {
        syncEngine.stopTyping(activeConversationId);
      }, 2500);
    }
  };

  // Feature 3: Send message with replyTo
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!activeConversationId) {
      alert('Please select or create a conversation first');
      return;
    }

    const text = inputText.trim();
    setInputText('');

    const replyPayload = replyingTo
      ? {
          _id: replyingTo.id,
          text: replyingTo.text ? replyingTo.text.slice(0, 100) : '[Attachment]',
          senderName: replyingTo.senderName || 'User',
        }
      : undefined;

    setReplyingTo(null);
    setShowEmojiPicker(false);

    if (myTypingTimerRef.current) clearTimeout(myTypingTimerRef.current);
    syncEngine.stopTyping(activeConversationId);

    await syncEngine.sendMessage(activeConversationId, text, {
      type: 'text',
      replyTo: replyPayload,
    });

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    if (activeConversationId) {
      wasNearBottomMapRef.current[activeConversationId] = true;
    }
  };

  // Feature 7: Image & File Attachment Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    const replyPayload = replyingTo
      ? {
          _id: replyingTo.id,
          text: replyingTo.text ? replyingTo.text.slice(0, 100) : '[Attachment]',
          senderName: replyingTo.senderName || 'User',
        }
      : undefined;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const isImg = file.type.startsWith('image/');
      const isAud = file.type.startsWith('audio/');
      const type = isImg ? 'image' : isAud ? 'audio' : 'file';

      try {
        const res = await apiFetch('/api/v1/attachments/upload', {
          method: 'POST',
          body: JSON.stringify({
            base64,
            fileName: file.name,
            mimeType: file.type,
          }),
        });
        const mediaUrl = res?.url || base64;
        await syncEngine.sendMessage(activeConversationId, file.name, {
          type,
          mediaUrl,
          fileName: file.name,
          fileSize: file.size,
          replyTo: replyPayload,
        });
      } catch {
        // Fallback: send directly as data URL
        await syncEngine.sendMessage(activeConversationId, file.name, {
          type,
          mediaUrl: base64,
          fileName: file.name,
          fileSize: file.size,
          replyTo: replyPayload,
        });
      }
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Feature 8: Send Audio Voice Note
  const handleSendVoiceNote = async (audioBase64: string, durationSeconds: number) => {
    setIsRecordingAudio(false);
    if (!activeConversationId) return;

    const replyPayload = replyingTo
      ? {
          _id: replyingTo.id,
          text: replyingTo.text ? replyingTo.text.slice(0, 100) : '[Attachment]',
          senderName: replyingTo.senderName || 'User',
        }
      : undefined;

    try {
      const res = await apiFetch('/api/v1/attachments/upload', {
        method: 'POST',
        body: JSON.stringify({
          base64: audioBase64,
          fileName: `voice_note_${Date.now()}.webm`,
          mimeType: 'audio/webm',
        }),
      });
      await syncEngine.sendMessage(activeConversationId, `Voice Note (${durationSeconds}s)`, {
        type: 'audio',
        mediaUrl: res?.url || audioBase64,
        fileName: 'voice_note.webm',
        replyTo: replyPayload,
      });
    } catch {
      await syncEngine.sendMessage(activeConversationId, `Voice Note (${durationSeconds}s)`, {
        type: 'audio',
        mediaUrl: audioBase64,
        fileName: 'voice_note.webm',
        replyTo: replyPayload,
      });
    }
    setReplyingTo(null);
  };

  // Feature 2: Message Reaction toggle
  const handleReaction = (msgId: string, emoji: string) => {
    if (!activeConversationId) return;
    syncEngine.reactToMessage(activeConversationId, msgId, emoji);
  };

  // Feature 6: Pinned Messages toggle
  const handleTogglePin = (msg: LocalMessage) => {
    const currentConv = conversations.find((c) => c._id === activeConversationId);
    const isPinned = currentConv?.pinnedMessage?.messageId === msg.id;
    syncEngine.pinMessage(activeConversationId, isPinned ? null : msg.id);
  };

  // Feature 18: Chat Export (.txt or .json)
  const handleExportChat = async (format: 'txt' | 'json') => {
    if (!activeConversationId) return;
    try {
      const token = localStorage.getItem('zena_token');
      const res = await fetch(`/api/v1/conversations/${activeConversationId}/export?format=${format}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zena_export_${activeConversationId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Failed to export conversation');
    }
  };

  // Feature 17: User Blocking
  const handleToggleBlock = async (targetUserId: string, block: boolean) => {
    try {
      const endpoint = block ? `/api/v1/users/block/${targetUserId}` : `/api/v1/users/unblock/${targetUserId}`;
      await apiFetch(endpoint, { method: 'POST' });
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const blocked = prev.blockedUsers || [];
        const updatedBlocked = block ? [...blocked, targetUserId] : blocked.filter((id) => id !== targetUserId);
        const updatedUser = { ...prev, blockedUsers: updatedBlocked };
        localStorage.setItem('zena_user', JSON.stringify(updatedUser));
        return updatedUser;
      });
      alert(block ? 'User has been blocked.' : 'User has been unblocked.');
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setRoomError(null);
    setRoomLoading(true);

    try {
      const newRoom = await apiFetch('/api/v1/conversations/group', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName.trim(),
          participantIds: [],
        }),
      });

      if (newRoom?._id) {
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === newRoom._id);
          return exists ? prev : [newRoom, ...prev];
        });
        selectConversation(newRoom._id);
        setNewRoomName('');
        setShowNewRoomModal(false);
      }
    } catch (err: any) {
      setRoomError(err.message || 'Failed to create room');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleCreateDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    setDmError(null);
    setDmLoading(true);

    try {
      const newDm = await apiFetch('/api/v1/conversations/dm', {
        method: 'POST',
        body: JSON.stringify({ username: targetUsername.trim().toLowerCase() }),
      });

      if (newDm?._id) {
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === newDm._id);
          return exists ? prev : [newDm, ...prev];
        });
        selectConversation(newDm._id);
        setTargetUsername('');
        setShowNewDmModal(false);
      }
    } catch (err: any) {
      setDmError(err.message || 'Failed to start direct message');
    } finally {
      setDmLoading(false);
    }
  };

  const handleStartEdit = (msg: LocalMessage) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (e: React.FormEvent, msgId: string) => {
    e.preventDefault();
    if (!editingText.trim()) return;
    const ok = await syncEngine.editMessage(activeConversationId, msgId, editingText.trim());
    if (ok) {
      setEditingMessageId(null);
      setEditingText('');
    } else {
      alert('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    const ok = await syncEngine.deleteMessage(activeConversationId, msgId);
    if (!ok) {
      alert('Failed to delete message');
    }
  };

  const handleDeleteConversation = async (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const conv = conversations.find((c) => c._id === convId);
    if (conv?.name === 'General Chat' && conv.type === 'group') {
      alert('General Chat cannot be deleted.');
      return;
    }

    const participantCount = conv?.participants?.length || 0;
    const isLast = participantCount <= 1;

    const confirmMsg = isLast
      ? `Are you sure you want to delete "${conv?.name || 'this conversation'}"? You are the last person in this conversation, so it will be permanently deleted forever.`
      : `Are you sure you want to delete "${conv?.name || 'this conversation'}"? It will be removed from your chat list, but other participants will still have access.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setIsDeletingConv(true);
    try {
      await apiFetch(`/api/v1/conversations/${convId}`, { method: 'DELETE' });
      await db.messages.where('conversationId').equals(convId).delete();

      setConversations((prev) => {
        const remaining = prev.filter((c) => c._id !== convId);
        setActiveConversationId((current) => {
          if (current === convId) {
            return remaining.length > 0 ? remaining[0]._id : '';
          }
          return current;
        });
        return remaining;
      });
    } catch (err: any) {
      alert(err.message || 'Failed to delete conversation');
    } finally {
      setIsDeletingConv(false);
    }
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'am' : 'en';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('zena_lang', nextLang);
  };

  const renderStatusIcon = (status: LocalMessage['status']) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3.5 h-3.5 text-gray-400 inline" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-gray-400 inline" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-gray-400 inline" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />;
      case 'failed':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline" />;
    }
  };

  // Active conversation helper
  const currentConv = conversations.find((c) => c._id === activeConversationId);
  const convTitle =
    currentConv?.name ||
    (currentConv?.participants
      ?.filter((p) => p._id !== currentUser?._id)
      ?.map((p) => p.displayName || p.username || p.name)
      ?.join(', ') || 'Select Conversation');

  const otherDmParticipant =
    currentConv?.type === 'dm'
      ? currentConv.participants?.find((p) => p._id !== currentUser?._id)
      : null;

  const isOtherUserBlocked =
    otherDmParticipant && currentUser?.blockedUsers?.includes(otherDmParticipant._id);

  const activeTypingUser = typingUsers[activeConversationId];

  // Landing page / Auth Modal
  if (!currentUser || showLandingForUser) {
    return (
      <div className="relative">
        <LandingPage
          onOpenAuth={(mode) => {
            if (currentUser) {
              setShowLandingForUser(false);
            } else {
              setAuthMode(mode);
              setShowAuthModal(true);
            }
          }}
          onDemoLogin={() => {
            if (currentUser) {
              setShowLandingForUser(false);
            } else {
              handleDemoLogin();
            }
          }}
          authLoading={authLoading}
          onToggleLanguage={toggleLanguage}
          currentLang={i18n.language}
        />

        {currentUser && (
          <div className="fixed bottom-6 right-6 z-50">
            <button
              onClick={() => setShowLandingForUser(false)}
              className="px-5 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-2xl flex items-center space-x-2 border border-emerald-400/40 hover:scale-105 transition"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Back to Chat</span>
            </button>
          </div>
        )}

        {!currentUser && showAuthModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAuthModal(false);
            }}
          >
            <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 relative">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="bg-zena-700 text-white p-6 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-zena-100" />
                <h2 className="text-2xl font-bold tracking-tight">{t('appName')}</h2>
                <p className="text-zena-100 text-xs mt-1">Resilient Real-Time Chat</p>
              </div>

              <div className="p-6">
                <div className="flex border-b border-gray-200 dark:border-slate-800 mb-6">
                  <button
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 py-2 font-semibold text-sm transition ${
                      authMode === 'login'
                        ? 'border-b-2 border-zena-600 text-zena-700 dark:text-zena-400'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    {t('signIn')}
                  </button>
                  <button
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 py-2 font-semibold text-sm transition ${
                      authMode === 'register'
                        ? 'border-b-2 border-zena-600 text-zena-700 dark:text-zena-400'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    {t('register')}
                  </button>
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium border border-red-200 dark:border-red-900">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          value={authForm.username}
                          onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                          placeholder="adnan_dev"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={authForm.displayName}
                          onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                          placeholder="Adnan"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {authMode === 'login' ? 'Email or Username' : 'Email Address'}
                    </label>
                    <input
                      type={authMode === 'login' ? 'text' : 'email'}
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder={authMode === 'login' ? 'demo@zena.chat or adnan_dev' : 'you@example.com'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 px-4 bg-zena-600 hover:bg-zena-700 text-white font-semibold rounded-lg text-sm shadow-md transition disabled:opacity-50"
                  >
                    {authLoading ? 'Please wait...' : authMode === 'login' ? t('signIn') : t('register')}
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-900 px-2 text-gray-400">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={authLoading}
                    className="w-full py-2.5 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold rounded-lg text-sm transition"
                  >
                    ⚡ Try Instant Demo Guest
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden antialiased select-none">
      {/* Toast Notification Banner */}
      {activeToast && (
        <div
          onClick={() => {
            selectConversation(activeToast.conversationId);
            setActiveToast(null);
          }}
          className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-800 border border-zena-200 dark:border-slate-700 shadow-2xl rounded-xl p-3 flex items-start space-x-3 max-w-xs sm:max-w-sm cursor-pointer hover:bg-zena-50/60 dark:hover:bg-slate-700/60 transition-all duration-200 border-l-4 border-l-zena-600"
        >
          <div className="w-8 h-8 rounded-full bg-zena-600 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                {activeToast.conversationTitle}
              </span>
              <span className="text-[9px] text-zena-600 dark:text-zena-400 font-bold uppercase tracking-wider shrink-0 ml-1">
                New Message
              </span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 truncate mt-0.5">
              <span className="text-gray-900 dark:text-gray-100 font-semibold">{activeToast.senderName}: </span>
              {activeToast.text}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Left Sidebar: Conversations */}
      <aside className="w-80 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
        {/* User Profile Header */}
        <div className="p-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div
            onClick={() => setViewingProfileUser(currentUser)}
            className="flex items-center space-x-2.5 cursor-pointer p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition overflow-hidden"
          >
            <div className="w-8 h-8 rounded-full bg-zena-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {currentUser.displayName?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                {currentUser.displayName || currentUser.username}
              </p>
              <p className="text-[10px] text-gray-400 truncate">@{currentUser.username}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setDmError(null);
                setTargetUsername('');
                setShowNewDmModal(true);
              }}
              title="New Direct Message"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setRoomError(null);
                setNewRoomName('');
                setShowNewRoomModal(true);
              }}
              title="New Room"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSoundSettings(true)}
              title="Sound & Notifications"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-xs space-y-3">
              <Users className="w-8 h-8 mx-auto opacity-30" />
              <p>No conversations yet</p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={() => setShowNewDmModal(true)}
                  className="px-3 py-1.5 bg-zena-600 text-white rounded text-xs font-semibold hover:bg-zena-700 transition"
                >
                  Start Direct Message
                </button>
                <button
                  onClick={() => setShowNewRoomModal(true)}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold hover:bg-gray-300 dark:hover:bg-slate-700 transition"
                >
                  Create Group Room
                </button>
              </div>
            </div>
          )}

          {conversations.map((c) => {
            const isSelected = c._id === activeConversationId;
            const count = unreadCounts[c._id] !== undefined ? unreadCounts[c._id] : (c.unreadCount || 0);
            const title =
              c.name ||
              (c.participants
                ?.filter((p) => p._id !== currentUser._id)
                ?.map((p) => p.displayName || p.username || p.name)
                ?.join(', ') || 'Chat Room');

            const lastSender = c.lastMessage?.sender?.displayName || c.lastMessage?.sender?.username;
            const lastSnippet = c.lastMessage?.text
              ? `${lastSender ? `${lastSender}: ` : ''}${c.lastMessage.text}`
              : c.type === 'group'
              ? 'Group Room'
              : 'Direct Message';

            const timeFormatted = formatTelegramTime(c.lastMessage?.sentAt || c.lastMessageAt);

            return (
              <div
                key={c._id}
                onClick={() => selectConversation(c._id)}
                className={`w-full text-left p-3 text-xs flex items-center justify-between group cursor-pointer transition ${
                  isSelected
                    ? 'bg-zena-50 dark:bg-slate-800/80 border-r-2 border-zena-600'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-800/40 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      isSelected
                        ? 'bg-zena-600 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {c.type === 'group' ? (
                      c.name === 'General Chat' ? '🌍' : <Users className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="truncate flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0 truncate">
                        <p
                          className={`truncate text-xs ${
                            count > 0 && !isSelected
                              ? 'font-bold text-gray-900 dark:text-gray-100'
                              : isSelected
                              ? 'font-bold text-zena-800 dark:text-zena-300'
                              : 'font-semibold text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {title}
                        </p>
                        {c.participants && c.participants.length > 0 && (
                          <span className="text-[10px] text-gray-400 font-normal ml-1 shrink-0">
                            ({c.participants.length})
                          </span>
                        )}
                      </div>
                      {timeFormatted && (
                        <span
                          className={`text-[10px] ml-1 shrink-0 ${
                            count > 0 ? 'text-zena-600 font-bold' : 'text-gray-400'
                          }`}
                        >
                          {timeFormatted}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p
                        className={`truncate text-[11px] ${
                          count > 0 && !isSelected
                            ? 'text-gray-900 dark:text-gray-100 font-semibold'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {lastSnippet}
                      </p>
                      {count > 0 && (
                        <span
                          className={`shrink-0 ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[20px] text-center shadow-xs ${
                            isSelected ? 'bg-zena-700 text-white' : 'bg-zena-600 text-white'
                          }`}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {c.name !== 'General Chat' && (
                  <button
                    onClick={(e) => {
                      handleDeleteConversation(c._id, e);
                      setUnreadCounts((prev) => {
                        const copy = { ...prev };
                        delete copy[c._id];
                        return copy;
                      });
                    }}
                    title="Delete Conversation"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition shrink-0 ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden relative">
        {/* Top Header */}
        <header className="bg-zena-700 dark:bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-zena-800 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 truncate">
            <MessageSquare className="w-6 h-6 text-zena-100 shrink-0" />
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h1
                  onClick={() => {
                    if (currentConv?.type === 'dm' && otherDmParticipant) {
                      setViewingProfileUser(otherDmParticipant);
                    } else if (currentConv?.type === 'group') {
                      setShowGroupSettings(true);
                    }
                  }}
                  className="text-sm font-bold tracking-tight truncate cursor-pointer hover:underline"
                >
                  {convTitle}
                </h1>
                {currentConv && (
                  <button
                    onClick={() => {
                      if (currentConv.type === 'group') setShowGroupSettings(true);
                    }}
                    className="px-2 py-0.5 rounded-full bg-zena-800/80 dark:bg-slate-800 text-zena-200 text-[10px] font-semibold flex items-center gap-1 border border-zena-600/50 dark:border-slate-700 shadow-2xs shrink-0"
                    title={`${currentConv.participants?.length || 0} participants`}
                  >
                    <Users className="w-3 h-3 text-zena-300" />
                    <span>{currentConv.participants?.length || 0}</span>
                  </button>
                )}
                {currentConv?.type === 'group' && currentConv.name !== 'General Chat' && (
                  <button
                    onClick={() => setShowGroupSettings(true)}
                    title="Room Settings"
                    className="text-zena-300 hover:text-white transition p-1 rounded"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
                {currentConv && currentConv.name !== 'General Chat' && (
                  <button
                    onClick={(e) => handleDeleteConversation(currentConv._id, e)}
                    disabled={isDeletingConv}
                    title="Delete Conversation"
                    className="text-zena-300 hover:text-red-300 transition p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {currentConv ? (
                <div className="flex items-center space-x-2 text-[10px] text-zena-200 mt-0.5">
                  <span>
                    {(currentConv.participants?.length || 0) === 1
                      ? '1 person'
                      : `${currentConv.participants?.length || 0} people`}
                  </span>
                  {(() => {
                    const onlineCount =
                      currentConv.participants?.filter(
                        (p) => p.isOnline && p._id !== currentUser?._id
                      )?.length || 0;
                    return onlineCount > 0 ? (
                      <>
                        <span>•</span>
                        <span className="text-emerald-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {onlineCount} online
                        </span>
                      </>
                    ) : null;
                  })()}
                  {activeTypingUser && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-300 font-semibold animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        {activeTypingUser.displayName || activeTypingUser.username} is typing...
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-zena-100">{t('appName')}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Feature 5: Search Toggle */}
            {activeConversationId && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1.5 rounded text-xs transition ${
                  showSearch ? 'bg-zena-900 text-white' : 'text-zena-200 hover:bg-zena-800'
                }`}
                title="Search Messages"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Feature 18: Export Chat */}
            {activeConversationId && (
              <div className="relative group">
                <button
                  title="Export Chat"
                  className="p-1.5 rounded text-xs text-zena-200 hover:bg-zena-800 transition"
                >
                  <Download className="w-4 h-4" />
                </button>
                <div className="absolute right-0 top-8 hidden group-hover:flex flex-col bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 w-32 z-30 text-xs">
                  <button
                    onClick={() => handleExportChat('txt')}
                    className="px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    Export as .txt
                  </button>
                  <button
                    onClick={() => handleExportChat('json')}
                    className="px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    Export as .json
                  </button>
                </div>
              </div>
            )}

            {/* Feature 20: System Architecture & Telemetry */}
            <button
              onClick={() => setShowSystemStatus(true)}
              className="p-1.5 rounded text-xs text-zena-200 hover:bg-zena-800 transition flex items-center space-x-1"
              title="System Telemetry & Architecture"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Feature 10: Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded text-xs text-zena-200 hover:bg-zena-800 transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Feature 15: PWA Install Button */}
            {installPrompt && (
              <button
                onClick={handleInstallPWA}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-xs transition"
              >
                <span>Install</span>
              </button>
            )}

            {/* Connection Status Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                connectionState === 'connected'
                  ? 'bg-emerald-100 text-emerald-800'
                  : connectionState === 'reconnecting'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {connectionState === 'connected' ? (
                <Wifi className="w-3 h-3" />
              ) : connectionState === 'reconnecting' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">{t(connectionState)}</span>
            </div>

            {/* About / Landing */}
            <button
              onClick={() => setShowLandingForUser(true)}
              className="px-2 py-1 rounded bg-zena-800 hover:bg-zena-900 text-xs font-semibold text-zena-200 hover:text-white transition"
              title="About Zena Chat"
            >
              About
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-zena-800 hover:bg-zena-900 text-xs font-semibold"
            >
              <Globe className="w-3 h-3" />
              <span>{i18n.language === 'en' ? 'አማርኛ' : 'EN'}</span>
            </button>
          </div>
        </header>

        {/* Feature 6: Pinned Message Banner */}
        {currentConv?.pinnedMessage?.text && (
          <div className="bg-zena-50 dark:bg-slate-800/80 border-b border-zena-200 dark:border-slate-700 px-4 py-2 text-xs flex items-center justify-between">
            <div
              onClick={() => {
                if (currentConv.pinnedMessage?.messageId) {
                  const el = document.querySelector(
                    `[data-msg-id="${currentConv.pinnedMessage.messageId}"]`
                  );
                  el?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex items-center space-x-2 truncate cursor-pointer hover:opacity-80 transition"
            >
              <Pin className="w-3.5 h-3.5 text-zena-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-gray-800 dark:text-gray-200 mr-1.5">
                  Pinned by {currentConv.pinnedMessage.senderName || 'Admin'}:
                </span>
                <span className="text-gray-600 dark:text-gray-300 truncate">
                  {currentConv.pinnedMessage.text}
                </span>
              </div>
            </div>
            <button
              onClick={() => syncEngine.pinMessage(activeConversationId, null)}
              title="Unpin message"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded ml-2 shrink-0"
            >
              <PinOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Feature 5: Search Input Bar */}
        {showSearch && (
          <div className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 px-4 py-2 flex items-center space-x-2 animate-in fade-in duration-150">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this conversation..."
              className="flex-1 bg-transparent text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Feature 17: Blocked User Warning */}
        {isOtherUserBlocked && (
          <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-900 px-4 py-2 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4" />
              <span>You have blocked this user. Messages cannot be sent or received.</span>
            </div>
            <button
              onClick={() => otherDmParticipant && handleToggleBlock(otherDmParticipant._id, false)}
              className="underline font-semibold hover:text-red-900"
            >
              Unblock
            </button>
          </div>
        )}

        {/* Outbox Pending Banner */}
        {pendingOutboxCount > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900 px-4 py-1.5 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>{t('outboxPending', { count: pendingOutboxCount })}</span>
            </div>
            <span className="text-amber-700 dark:text-amber-300 font-medium">Offline Queue Active</span>
          </div>
        )}

        {/* Messages View */}
        {!activeConversationId ? (
          <main className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-slate-900">
            <MessageSquare className="w-14 h-14 text-zena-300 mb-3" />
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
              Welcome to Zena Chat
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-5">
              Select an existing chat from the sidebar or start a new conversation below.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => {
                  setDmError(null);
                  setTargetUsername('');
                  setShowNewDmModal(true);
                }}
                className="px-4 py-2 bg-zena-600 text-white rounded-lg text-xs font-semibold hover:bg-zena-700 flex items-center space-x-1.5 shadow-sm transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Start Direct Message</span>
              </button>
              <button
                onClick={() => {
                  setRoomError(null);
                  setNewRoomName('');
                  setShowNewRoomModal(true);
                }}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center space-x-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group Room</span>
              </button>
            </div>
          </main>
        ) : (
          <main
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50 dark:bg-slate-950 relative"
          >
            {(!messages || messages.length === 0) && (
              <div className="text-center py-20 text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('noConversations')}</p>
              </div>
            )}

            {(() => {
              const boundary = readBoundaryMap[activeConversationId];
              const unreadNum = unreadCounts[activeConversationId] ?? 0;
              const hasUnread = (boundary !== null && boundary !== undefined) || unreadNum > 0;
              let firstUnreadIndex = hasUnread && messages
                ? messages.findIndex(
                    (m) =>
                      typeof m.seq === 'number' &&
                      boundary !== null &&
                      boundary !== undefined &&
                      m.seq > boundary &&
                      m.senderId !== currentUser._id &&
                      m.senderId !== 'self'
                  )
                : -1;

              if (firstUnreadIndex === -1 && unreadNum > 0 && messages) {
                const otherMessages = messages.filter(
                  (m) => m.senderId !== currentUser._id && m.senderId !== 'self'
                );
                if (otherMessages.length > 0) {
                  const targetMsg = otherMessages[Math.max(0, otherMessages.length - unreadNum)];
                  firstUnreadIndex = messages.findIndex((m) => m.id === targetMsg?.id);
                }
              }

              const unreadCountInView =
                firstUnreadIndex >= 0 && messages ? messages.length - firstUnreadIndex : 0;
              const currentRemainingCount =
                unreadCounts[activeConversationId] !== undefined
                  ? unreadCounts[activeConversationId]
                  : unreadCountInView;

              const visibleMessages = messages?.filter((m) => {
                if (!searchQuery.trim()) return true;
                return m.text?.toLowerCase().includes(searchQuery.toLowerCase().trim());
              });

              return visibleMessages?.map((msg, index) => {
                const isMe = msg.senderId === currentUser._id || msg.senderId === 'self';
                const isEditing = editingMessageId === msg.id;
                const isFirstUnread = index === firstUnreadIndex;
                const timeFormatted = new Intl.DateTimeFormat('en-US', {
                  timeZone: 'Africa/Addis_Ababa',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(msg.createdAt));

                const firstUrl = extractFirstUrl(msg.text || '');

                return (
                  <React.Fragment key={msg.id || msg.clientMsgId}>
                    {/* Telegram-style Unread Messages Separator Bar */}
                    {isFirstUnread && (
                      <div
                        ref={unreadSeparatorRef}
                        className="my-5 flex items-center justify-center space-x-3 text-xs select-none sticky top-2 z-10"
                      >
                        <div className="flex-1 border-t border-zena-300 dark:border-slate-700 shadow-2xs" />
                        <span className="px-3.5 py-1 bg-zena-100/95 dark:bg-slate-800 text-zena-800 dark:text-zena-300 font-bold rounded-full shadow-xs text-[11px] tracking-wide flex items-center gap-1.5 border border-zena-300 dark:border-slate-700 backdrop-blur-xs">
                          <span className="w-2 h-2 rounded-full bg-zena-600 animate-pulse" />
                          <span>
                            {currentRemainingCount > 0
                              ? `Unread Messages (${currentRemainingCount})`
                              : 'All Messages Read ✓'}
                          </span>
                        </span>
                        <div className="flex-1 border-t border-zena-300 dark:border-slate-700 shadow-2xs" />
                      </div>
                    )}

                    <div
                      data-seq={msg.seq}
                      data-msg-id={msg.id}
                      data-sender-id={msg.senderId}
                      className={`message-item flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative transition-all ${
                          isMe
                            ? 'bg-zena-600 text-white rounded-br-xs'
                            : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-xs border border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Sender header */}
                        {!isMe && msg.senderName && (
                          <p
                            onClick={() => {
                              const found = currentConv?.participants?.find(
                                (p) => p._id === msg.senderId
                              );
                              setViewingProfileUser(
                                found || { _id: msg.senderId, displayName: msg.senderName, username: msg.senderName }
                              );
                            }}
                            className="text-xs font-semibold text-zena-700 dark:text-zena-400 mb-1 cursor-pointer hover:underline"
                          >
                            {msg.senderName}
                          </p>
                        )}

                        {/* Feature 3: Quoted Reply Box */}
                        {msg.replyTo && (
                          <div
                            onClick={() => {
                              const el = document.querySelector(
                                `[data-msg-id="${msg.replyTo?._id}"]`
                              );
                              el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`mb-2 p-2 rounded-lg text-xs border-l-4 cursor-pointer transition ${
                              isMe
                                ? 'bg-zena-700/60 border-l-white text-green-100'
                                : 'bg-gray-100 dark:bg-slate-700/60 border-l-zena-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <p className="font-bold text-[10px] opacity-90">
                              {msg.replyTo.senderName || 'User'}
                            </p>
                            <p className="truncate opacity-80 mt-0.5">{msg.replyTo.text}</p>
                          </div>
                        )}

                        {/* Feature 7: Image Attachment Rendering */}
                        {msg.type === 'image' && msg.mediaUrl && (
                          <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                            <img
                              src={msg.mediaUrl}
                              alt={msg.fileName || 'Attachment'}
                              onClick={() => setLightboxSrc(msg.mediaUrl || null)}
                              className="max-h-60 rounded-xl object-cover hover:scale-[1.02] transition-transform duration-200"
                            />
                          </div>
                        )}

                        {/* Feature 8: Voice Note / Audio Player */}
                        {msg.type === 'audio' && msg.mediaUrl && (
                          <div className="mb-1">
                            <AudioPlayer src={msg.mediaUrl} isMe={isMe} />
                          </div>
                        )}

                        {/* Feature 7: Document File Attachment */}
                        {msg.type === 'file' && (
                          <div
                            className={`mb-2 p-2.5 rounded-xl flex items-center space-x-3 border ${
                              isMe
                                ? 'bg-zena-700/70 border-zena-500'
                                : 'bg-gray-50 dark:bg-slate-700/40 border-gray-200 dark:border-slate-700'
                            }`}
                          >
                            <FileText className="w-7 h-7 text-zena-300 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate">{msg.fileName || 'Document'}</p>
                              <p className="text-[10px] opacity-75">{formatFileSize(msg.fileSize)}</p>
                            </div>
                            {msg.mediaUrl && (
                              <a
                                href={msg.mediaUrl}
                                download={msg.fileName || 'file'}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-current transition shrink-0"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Message Text Editing or View */}
                        {isEditing ? (
                          <form onSubmit={(e) => handleSaveEdit(e, msg.id)} className="space-y-2 mt-1">
                            <input
                              type="text"
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full px-2.5 py-1 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded border border-gray-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-zena-400"
                            />
                            <div className="flex justify-end space-x-1.5 text-xs">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={!editingText.trim()}
                                className="px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        ) : (
                          <p className="break-words leading-relaxed whitespace-pre-wrap">
                            {searchQuery.trim() && msg.text ? (
                              <span>
                                {msg.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                                  part.toLowerCase() === searchQuery.toLowerCase() ? (
                                    <mark key={i} className="bg-amber-300 text-black px-0.5 rounded">
                                      {part}
                                    </mark>
                                  ) : (
                                    part
                                  )
                                )}
                              </span>
                            ) : (
                              msg.text
                            )}
                          </p>
                        )}

                        {/* Feature 9: Rich Link Preview Card */}
                        {firstUrl && (
                          <a
                            href={firstUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-2 block p-2.5 rounded-xl border transition ${
                              isMe
                                ? 'bg-zena-700/60 border-zena-500 hover:bg-zena-700/80'
                                : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-1.5 text-xs font-semibold">
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span className="truncate">{new URL(firstUrl).hostname}</span>
                            </div>
                            <p className="text-[11px] opacity-75 truncate mt-0.5">{firstUrl}</p>
                          </a>
                        )}

                        {/* Time & Delivery Status */}
                        <div
                          className={`text-[10px] mt-1 flex items-center justify-end space-x-1.5 ${
                            isMe ? 'text-green-100' : 'text-gray-400'
                          }`}
                        >
                          {msg.editedAt && <span className="italic opacity-80">(edited)</span>}
                          <span>{timeFormatted}</span>
                          {isMe && renderStatusIcon(msg.status)}
                        </div>

                        {/* Feature 2: Message Reactions display pills */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-black/10 dark:border-white/10">
                            {(() => {
                              const grouped: Record<string, string[]> = {};
                              msg.reactions.forEach((r) => {
                                grouped[r.emoji] = grouped[r.emoji] || [];
                                grouped[r.emoji].push(r.userId);
                              });
                              return Object.entries(grouped).map(([emoji, userIds]) => {
                                const hasReacted = userIds.includes(currentUser._id);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReaction(msg.id, emoji)}
                                    className={`px-1.5 py-0.5 rounded-full text-xs flex items-center space-x-1 transition transform active:scale-90 ${
                                      hasReacted
                                        ? 'bg-zena-100 dark:bg-zena-900 border border-zena-400 text-zena-800 dark:text-zena-200'
                                        : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 text-current'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[10px] font-bold">{userIds.length}</span>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        )}

                        {/* Message Hover Action Bar */}
                        {!isEditing && (
                          <div className="absolute -top-3.5 right-2 hidden group-hover:flex items-center space-x-0.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-md px-1 py-0.5 z-10 text-gray-600 dark:text-gray-300">
                            {/* Quick Reactions */}
                            {['👍', '❤️', '😂', '🔥', '🎉'].map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => handleReaction(msg.id, em)}
                                className="p-1 hover:scale-125 transition rounded"
                              >
                                {em}
                              </button>
                            ))}

                            <div className="w-[1px] h-3 bg-gray-200 dark:bg-slate-700 mx-1" />

                            {/* Reply button */}
                            <button
                              type="button"
                              onClick={() => setReplyingTo(msg)}
                              title="Reply"
                              className="p-1 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* Pin button */}
                            <button
                              type="button"
                              onClick={() => handleTogglePin(msg)}
                              title="Pin / Unpin"
                              className="p-1 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit / Delete for own messages */}
                            {isMe && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(msg)}
                                  title="Edit"
                                  className="p-1 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  title="Delete"
                                  className="p-1 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
            <div ref={messagesEndRef} />
          </main>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 z-20 p-2.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:text-zena-600 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center group active:scale-95"
            title="Scroll to latest messages"
          >
            <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
            {(() => {
              const boundary = readBoundaryMap[activeConversationId];
              const unreadNum = unreadCounts[activeConversationId] ?? 0;
              const hasUnread = (boundary !== null && boundary !== undefined) || unreadNum > 0;
              let firstUnreadIdx = hasUnread && messages
                ? messages.findIndex(
                    (m) =>
                      typeof m.seq === 'number' &&
                      boundary !== null &&
                      boundary !== undefined &&
                      m.seq > boundary &&
                      m.senderId !== currentUser._id &&
                      m.senderId !== 'self'
                  )
                : -1;

              if (firstUnreadIdx === -1 && unreadNum > 0 && messages) {
                const otherMessages = messages.filter(
                  (m) => m.senderId !== currentUser._id && m.senderId !== 'self'
                );
                if (otherMessages.length > 0) {
                  const targetMsg = otherMessages[Math.max(0, otherMessages.length - unreadNum)];
                  firstUnreadIdx = messages.findIndex((m) => m.id === targetMsg?.id);
                }
              }

              const unreadCountInView =
                firstUnreadIdx >= 0 && messages ? messages.length - firstUnreadIdx : 0;
              const displayCount =
                unreadCounts[activeConversationId] !== undefined
                  ? unreadCounts[activeConversationId]
                  : unreadCountInView;
              return (
                displayCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-zena-600 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center shadow-xs">
                    {displayCount > 99 ? '99+' : displayCount}
                  </span>
                )
              );
            })()}
          </button>
        )}

        {/* Feature 3: Quoted Reply Bar above input */}
        {replyingTo && (
          <div className="bg-gray-100 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 truncate border-l-4 border-l-zena-600 pl-2">
              <CornerUpLeft className="w-4 h-4 text-zena-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-gray-800 dark:text-gray-200 mr-1.5">
                  Replying to {replyingTo.senderName || 'User'}:
                </span>
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {replyingTo.text || '[Attachment]'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Message Compose Form */}
        <footer className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 relative">
          {/* Feature 4: Emoji Picker popover */}
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={(emoji) => {
                setInputText((prev) => prev + emoji);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
          />

          {/* Feature 8: In-line Voice Recording Mode */}
          {isRecordingAudio ? (
            <AudioRecorder
              onSend={handleSendVoiceNote}
              onCancel={() => setIsRecordingAudio(false)}
            />
          ) : (
            <form onSubmit={handleSend} className="flex items-center space-x-2">
              {/* Feature 7: Attachment button */}
              <button
                type="button"
                disabled={!activeConversationId}
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition disabled:opacity-40"
                title="Attach Image or File"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Feature 4: Emoji Picker button */}
              <button
                type="button"
                disabled={!activeConversationId}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2 rounded-full transition disabled:opacity-40 ${
                  showEmojiPicker
                    ? 'text-zena-600 bg-zena-50 dark:bg-slate-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                title="Add Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                disabled={!activeConversationId}
                value={inputText}
                onChange={handleInputChange}
                placeholder={activeConversationId ? t('typeMessage') : 'Select or start a conversation to chat...'}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-full text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-zena-500 focus:bg-white dark:focus:bg-slate-900 transition disabled:opacity-50"
              />

              {/* Feature 8: Mic button if input empty, else Send button */}
              {!inputText.trim() ? (
                <button
                  type="button"
                  disabled={!activeConversationId}
                  onClick={() => setIsRecordingAudio(true)}
                  className="p-2.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-zena-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
                  title="Record Voice Note"
                >
                  <Mic className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() || !activeConversationId}
                  className="p-2.5 rounded-full bg-zena-600 text-white hover:bg-zena-700 disabled:opacity-40 disabled:cursor-not-allowed transition transform active:scale-95 shadow-sm"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>
          )}
        </footer>
      </div>

      {/* Feature 7: Media Lightbox */}
      {lightboxSrc && (
        <MediaLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* Feature 11: User Profile Modal */}
      {viewingProfileUser && (
        <UserProfileModal
          user={viewingProfileUser}
          currentUserId={currentUser._id}
          isBlocked={currentUser.blockedUsers?.includes(viewingProfileUser._id)}
          onUpdateCurrentUser={(updated) => {
            setCurrentUser((prev) => ({ ...prev, ...updated }));
            localStorage.setItem('zena_user', JSON.stringify({ ...currentUser, ...updated }));
          }}
          onToggleBlock={handleToggleBlock}
          onClose={() => setViewingProfileUser(null)}
        />
      )}

      {/* Feature 14: Group Room Settings Modal */}
      {showGroupSettings && currentConv && (
        <GroupSettingsModal
          conversation={currentConv}
          currentUserId={currentUser._id}
          onUpdateConversation={(updated) => {
            setConversations((prev) =>
              prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c))
            );
          }}
          onClose={() => setShowGroupSettings(false)}
        />
      )}

      {/* Feature 13: Sound Settings Modal */}
      {showSoundSettings && (
        <SoundSettingsModal onClose={() => setShowSoundSettings(false)} />
      )}

      {/* Feature 20: System Status Modal */}
      {showSystemStatus && (
        <SystemStatusModal onClose={() => setShowSystemStatus(false)} />
      )}

      {/* New Room Modal */}
      {showNewRoomModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-5 border border-gray-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
              Create or Join a Room
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Enter a room name. If the room already exists, you will join it.
            </p>
            {roomError && (
              <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded text-xs border border-red-200 dark:border-red-900">
                {roomError}
              </div>
            )}
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Football Fans, Study Group"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRoomModal(false);
                    setRoomError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roomLoading || !newRoomName.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-zena-600 text-white hover:bg-zena-700 rounded disabled:opacity-50"
                >
                  {roomLoading ? 'Connecting...' : 'Join / Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Direct Message Modal */}
      {showNewDmModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-5 border border-gray-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
              Start Direct Message
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Enter the username of the user you want to chat with.
            </p>
            {dmError && (
              <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded text-xs border border-red-200 dark:border-red-900">
                {dmError}
              </div>
            )}
            <form onSubmit={handleCreateDM} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="e.g. adnan_dev"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDmModal(false);
                    setDmError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dmLoading || !targetUsername.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-zena-600 text-white hover:bg-zena-700 rounded disabled:opacity-50"
                >
                  {dmLoading ? 'Starting...' : 'Start Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
