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
} from 'lucide-react';
import { db, LocalMessage } from './db';
import { syncEngine, ConnectionState } from './sync/engine';
import { apiFetch } from './api';

interface UserData {
  _id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
}

interface ConversationItem {
  _id: string;
  type: 'dm' | 'group';
  name?: string;
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
  participants: Array<{ _id: string; username?: string; displayName?: string; name?: string; isOnline?: boolean }>;
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

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
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

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);

  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const [dmLoading, setDmLoading] = useState(false);

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
  const activeConvIdRef = useRef(activeConversationId);
  const positionedConvIdRef = useRef<string | null>(null);

  // Exact scroll memory per conversation (saves where user was when leaving)
  const scrollPosMapRef = useRef<Record<string, number>>({});
  const wasNearBottomMapRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    activeConvIdRef.current = activeConversationId;
    positionedConvIdRef.current = null;
    setShowScrollBottom(false);
  }, [activeConversationId]);

  const selectConversation = (convId: string) => {
    if (!convId) return;

    // Save exact position for the conversation we are exiting
    if (activeConversationId && messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      scrollPosMapRef.current[activeConversationId] = scrollTop;
      wasNearBottomMapRef.current[activeConversationId] = scrollHeight - scrollTop - clientHeight < 80;
    }

    positionedConvIdRef.current = null;
    setShowScrollBottom(false);

    // Initialize reading boundary for this conversation session
    const conv = conversations.find((c) => String(c._id) === String(convId));
    const hasUnread = (unreadCounts[convId] ?? 0) > 0 || (conv?.unreadCount ?? 0) > 0;
    const boundary = hasUnread ? (conv?.lastReadSeq ?? 0) : null;
    setReadBoundaryMap((prev) => ({ ...prev, [convId]: boundary }));

    setActiveConversationId(convId);
    fetchHistory(convId);
    syncEngine.joinConversation(convId);
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 80;

    if (activeConversationId) {
      scrollPosMapRef.current[activeConversationId] = scrollTop;
      wasNearBottomMapRef.current[activeConversationId] = nearBottom;
    }

    setShowScrollBottom(!nearBottom);

    if (nearBottom && activeConversationId) {
      if ((unreadCounts[activeConversationId] ?? 0) > 0) {
        setUnreadCounts((prev) => ({ ...prev, [activeConversationId]: 0 }));
        const highestSeq =
          messages && messages.length > 0 ? Math.max(...messages.map((m) => m.seq || 0)) : 0;
        if (highestSeq > 0) {
          syncEngine.markAsRead(activeConversationId, highestSeq);
        }
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    if (activeConversationId) {
      wasNearBottomMapRef.current[activeConversationId] = true;
      if ((unreadCounts[activeConversationId] ?? 0) > 0) {
        setUnreadCounts((prev) => ({ ...prev, [activeConversationId]: 0 }));
        const highestSeq =
          messages && messages.length > 0 ? Math.max(...messages.map((m) => m.seq || 0)) : 0;
        if (highestSeq > 0) {
          syncEngine.markAsRead(activeConversationId, highestSeq);
        }
      }
    }
  };

  // Unlock Web Audio on first user interaction so notification sound can play freely
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

  // Auto-dismiss top banner notification toast after 5 seconds
  useEffect(() => {
    if (!activeToast) return;
    const t = setTimeout(() => setActiveToast(null), 5000);
    return () => clearTimeout(t);
  }, [activeToast]);

  // Request browser desktop notification permission when logged in
  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [currentUser]);

  // Dynamic page title with total unread count (Telegram-style)
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + (n || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Zena Chat`;
    } else {
      document.title = 'Zena Chat';
    }
  }, [unreadCounts]);

  // Reactive IndexedDB messages query with deduplication
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

  // Listen to new conversations and new messages from socket in real-time
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

    const unsubMsg = syncEngine.onMessageNew((newMsg) => {
      const convId = String(newMsg.conversationId);
      const isFromMe =
        String(newMsg.senderId?._id || newMsg.senderId) === String(currentUser?._id) ||
        newMsg.senderUsername === currentUser?.username;

      // Update conversations list in-place: update lastMessage and re-sort (Telegram-style)
      setConversations((prev) => {
        const index = prev.findIndex((c) => String(c._id) === convId);
        if (index === -1) {
          loadConversations();
          return prev;
        }

        const updated = [...prev];
        const target = { ...updated[index] };
        target.lastMessage = {
          text: newMsg.text || '[Attachment]',
          sender: {
            _id: newMsg.senderId?._id || newMsg.senderId,
            displayName: newMsg.senderDisplayName || newMsg.senderUsername,
            username: newMsg.senderUsername,
          },
          sentAt: newMsg.createdAt,
        };
        target.lastMessageAt = newMsg.createdAt;

        // Keep General Chat pinned at index 0, move this active conversation to top of others
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

      // Telegram-style unread notification
      const isCurrentlyViewing = convId === String(activeConvIdRef.current) && document.visibilityState === 'visible';
      if (!isFromMe && !isCurrentlyViewing) {
        setUnreadCounts((prev) => ({
          ...prev,
          [convId]: (prev[convId] || 0) + 1,
        }));
      }

      // Audio notification and visual banner for incoming messages from others
      if (!isFromMe) {
        playNotificationChime();

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

        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
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
      unsubMsg();
    };
  }, []);

  // Initialize socket when user is logged in
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

  // Fetch recent messages into IndexedDB cache when active conversation changes
  const fetchHistory = async (convId: string) => {
    if (!convId) return;
    try {
      const data = await apiFetch(`/api/v1/conversations/${convId}/messages?limit=100`);

      if (data?.lastReadSeq !== undefined) {
        setReadBoundaryMap((prev) => {
          if (prev[convId] !== undefined && prev[convId] !== null) return prev;
          const conv = conversations.find((c) => String(c._id) === String(convId));
          const hasUnread = (unreadCounts[convId] ?? 0) > 0 || (conv?.unreadCount ?? 0) > 0;
          return { ...prev, [convId]: hasUnread ? data.lastReadSeq : null };
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

  // Join active conversation room on socket & fetch recent messages
  useEffect(() => {
    if (activeConversationId) {
      syncEngine.joinConversation(activeConversationId);
      fetchHistory(activeConversationId);
    }
  }, [activeConversationId, connectionState]);

  // Smart scrolling on message load or new message (Telegram-style)
  useEffect(() => {
    if (!messages || messages.length === 0 || !activeConversationId) return;

    // Once initial positioning for this active conversation is done, NEVER AUTO-SCROLL ON INCOMING MESSAGES!
    if (positionedConvIdRef.current === activeConversationId) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) return;

    const boundary = readBoundaryMap[activeConversationId];
    const unreadNum = unreadCounts[activeConversationId] ?? 0;
    const hasUnread = (boundary !== null && boundary !== undefined) || unreadNum > 0;

    // CASE 1: Conversation has NEW unread messages! Position and lock directly on unread separator
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
          });
          return;
        }
        // If separator not mounted in DOM yet, do not mark as positioned; wait for DOM render
        return;
      }
    }

    // CASE 2: No new unread messages — Restore exact previous scroll position if user was reading older messages
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

    // CASE 3: No unread messages & user was at bottom or first visit -> Position at the BOTTOM!
    // NEVER go to the top for messages already read!
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
      // Try login first
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: demoEmail, password: demoPassword }),
      }).catch(async () => {
        // If demo user doesn't exist, register
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
    syncEngine.disconnect();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!activeConversationId) {
      alert('Please select or create a conversation first');
      return;
    }

    const text = inputText.trim();
    setInputText('');
    await syncEngine.sendMessage(activeConversationId, text);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    if (activeConversationId) {
      wasNearBottomMapRef.current[activeConversationId] = true;
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

  // If user is not logged in, render the Auth Form
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-zena-700 text-white p-6 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-zena-100" />
            <h1 className="text-2xl font-bold tracking-tight">{t('appName')}</h1>
            <p className="text-zena-100 text-sm mt-1">Production Real-Time Chat</p>
          </div>

          <div className="p-6">
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 font-semibold text-sm transition ${
                  authMode === 'login'
                    ? 'border-b-2 border-zena-600 text-zena-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 font-semibold text-sm transition ${
                  authMode === 'register'
                    ? 'border-b-2 border-zena-600 text-zena-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-200">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                      placeholder="e.g. adnan_dev"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zena-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Display Name</label>
                    <input
                      type="text"
                      required
                      value={authForm.displayName}
                      onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                      placeholder="e.g. Adnan"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zena-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {authMode === 'login' ? 'Email or Username' : 'Email Address'}
                </label>
                <input
                  type={authMode === 'login' ? 'text' : 'email'}
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder={authMode === 'login' ? 'username or email' : 'you@example.com'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-zena-600 text-white rounded-lg font-semibold text-sm hover:bg-zena-700 transition disabled:opacity-50"
              >
                {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <span className="relative bg-white px-3 text-xs text-gray-400 font-medium">OR</span>
            </div>

            <button
              onClick={handleDemoLogin}
              disabled={authLoading}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-xs hover:bg-gray-200 transition border border-gray-300 flex items-center justify-center space-x-2"
            >
              <User className="w-4 h-4 text-gray-500" />
              <span>Instant Guest / Demo Login (1-Click)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active conversation title
  const currentConv = conversations.find((c) => c._id === activeConversationId);
  const convTitle =
    currentConv?.name ||
    (currentConv?.participants
      ?.filter((p) => p._id !== currentUser._id)
      ?.map((p) => p.displayName || p.username || p.name)
      ?.join(', ') || 'Chat Room');

  return (
    <div className="relative flex h-screen max-w-5xl mx-auto bg-white shadow-xl overflow-hidden border-x border-gray-200">
      {/* Floating Telegram-Style Toast Notification */}
      {activeToast && (
        <div
          onClick={() => {
            selectConversation(activeToast.conversationId);
            setActiveToast(null);
          }}
          className="fixed top-4 right-4 z-50 bg-white border border-zena-200 shadow-2xl rounded-xl p-3 flex items-start space-x-3 max-w-xs sm:max-w-sm cursor-pointer hover:bg-zena-50/60 transition-all duration-200 border-l-4 border-l-zena-600"
        >
          <div className="w-8 h-8 rounded-full bg-zena-600 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 truncate">{activeToast.conversationTitle}</span>
              <span className="text-[9px] text-zena-600 font-bold uppercase tracking-wider shrink-0 ml-1">New Message</span>
            </div>
            <p className="text-[11px] text-gray-600 truncate mt-0.5">
              <span className="text-gray-900 font-semibold">{activeToast.senderName}: </span>
              {activeToast.text}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
            className="text-gray-400 hover:text-gray-600 p-0.5 rounded shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Left Sidebar: Conversations */}
      <aside className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* User Profile Header */}
        <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-zena-600 text-white flex items-center justify-center font-bold text-sm">
              {currentUser.displayName?.[0] || currentUser.username?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-800 truncate">{currentUser.displayName || currentUser.username}</p>
              <p className="text-[10px] text-gray-400">@{currentUser.username}</p>
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
              className="p-1.5 text-gray-500 hover:text-zena-600 hover:bg-gray-100 rounded"
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
              className="p-1.5 text-gray-500 hover:text-zena-600 hover:bg-gray-100 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {conversations.length === 0 && (
            <div className="p-4 text-center text-gray-400 text-xs space-y-3">
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
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-semibold hover:bg-gray-300 transition"
                >
                  Create Group Room
                </button>
              </div>
            </div>
          )}

          {conversations.map((c) => {
            const isSelected = c._id === activeConversationId;
            const count = unreadCounts[c._id] || 0;
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
                onClick={() => {
                  selectConversation(c._id);
                }}
                className={`w-full text-left p-3 text-xs flex items-center justify-between group cursor-pointer transition ${
                  isSelected ? 'bg-zena-50 border-r-2 border-zena-600' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      isSelected ? 'bg-zena-600 text-white' : 'bg-gray-200 text-gray-700'
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
                              ? 'font-bold text-gray-900'
                              : isSelected
                              ? 'font-bold text-zena-800'
                              : 'font-semibold text-gray-800'
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
                            count > 0 && !isSelected ? 'text-zena-600 font-bold' : 'text-gray-400'
                          }`}
                        >
                          {timeFormatted}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p
                        className={`truncate text-[11px] ${
                          count > 0 && !isSelected ? 'text-gray-900 font-semibold' : 'text-gray-500'
                        }`}
                      >
                        {lastSnippet}
                      </p>
                      {count > 0 && !isSelected && (
                        <span className="shrink-0 ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-zena-600 text-white rounded-full min-w-[20px] text-center shadow-xs">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete button (for all chats except protected General Chat) */}
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-200 rounded transition shrink-0 ml-1"
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
      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {/* Top Header */}
        <header className="bg-zena-700 text-white px-4 py-3 flex items-center justify-between border-b border-zena-800">
          <div className="flex items-center space-x-3 truncate">
            <MessageSquare className="w-6 h-6 text-zena-100 shrink-0" />
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold tracking-tight truncate">{convTitle}</h1>
                {currentConv && (
                  <span
                    className="px-2 py-0.5 rounded-full bg-zena-800/80 text-zena-200 text-[10px] font-semibold flex items-center gap-1 border border-zena-600/50 shadow-2xs shrink-0"
                    title={`${currentConv.participants?.length || 0} participants`}
                  >
                    <Users className="w-3 h-3 text-zena-300" />
                    <span>{currentConv.participants?.length || 0}</span>
                  </span>
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
                </div>
              ) : (
                <p className="text-[10px] text-zena-100">{t('appName')}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Connection Status Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                connectionState === 'connected'
                  ? 'bg-green-100 text-green-800'
                  : connectionState === 'reconnecting'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {connectionState === 'connected' ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : connectionState === 'reconnecting' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span>{t(connectionState)}</span>
            </div>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zena-800 hover:bg-zena-900 text-xs font-semibold"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{i18n.language === 'en' ? 'አማርኛ' : 'EN'}</span>
            </button>
          </div>
        </header>

        {/* Outbox Pending Banner */}
        {pendingOutboxCount > 0 && (
          <div className="bg-amber-50 text-amber-900 border-b border-amber-200 px-4 py-1.5 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>{t('outboxPending', { count: pendingOutboxCount })}</span>
            </div>
            <span className="text-amber-700 font-medium">Offline Queue Active</span>
          </div>
        )}

        {/* Chat Messages View or Empty Selection View */}
        {!activeConversationId ? (
          <main className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-gray-50">
            <MessageSquare className="w-14 h-14 text-zena-300 mb-3" />
            <h2 className="text-base font-bold text-gray-800 mb-1">Welcome to Zena Chat</h2>
            <p className="text-xs text-gray-500 max-w-xs mb-5">
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
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 flex items-center space-x-1.5 shadow-sm transition"
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
            className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50 relative"
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

              return messages?.map((msg, index) => {
                const isMe = msg.senderId === currentUser._id || msg.senderId === 'self';
                const isEditing = editingMessageId === msg.id;
                const isFirstUnread = index === firstUnreadIndex;
                const timeFormatted = new Intl.DateTimeFormat('en-US', {
                  timeZone: 'Africa/Addis_Ababa',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(msg.createdAt));

                return (
                  <React.Fragment key={msg.id || msg.clientMsgId}>
                    {/* Telegram-style Unread Messages Separator Bar */}
                    {isFirstUnread && (
                      <div
                        ref={unreadSeparatorRef}
                        className="my-5 flex items-center justify-center space-x-3 text-xs select-none sticky top-2 z-10"
                      >
                        <div className="flex-1 border-t border-zena-300 shadow-2xs" />
                        <span className="px-3.5 py-1 bg-zena-100/95 text-zena-800 font-bold rounded-full shadow-xs text-[11px] tracking-wide flex items-center gap-1.5 border border-zena-300 backdrop-blur-xs">
                          <span className="w-2 h-2 rounded-full bg-zena-600 animate-pulse" />
                          <span>Unread Messages ({unreadCountInView})</span>
                        </span>
                        <div className="flex-1 border-t border-zena-300 shadow-2xs" />
                      </div>
                    )}

                    <div
                      className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative ${
                          isMe
                            ? 'bg-zena-600 text-white rounded-br-xs'
                            : 'bg-white text-gray-900 rounded-bl-xs border border-gray-200'
                        }`}
                      >
                        {!isMe && msg.senderName && (
                          <p className="text-xs font-semibold text-zena-700 mb-1">
                            {msg.senderName}
                          </p>
                        )}

                        {isEditing ? (
                          <form onSubmit={(e) => handleSaveEdit(e, msg.id)} className="space-y-2 mt-1">
                            <input
                              type="text"
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full px-2.5 py-1 text-sm bg-white text-gray-900 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-zena-400"
                            />
                            <div className="flex justify-end space-x-1.5 text-xs">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
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
                          <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}

                        <div
                          className={`text-[10px] mt-1 flex items-center justify-end space-x-1.5 ${
                            isMe ? 'text-green-100' : 'text-gray-400'
                          }`}
                        >
                          {msg.editedAt && <span className="italic opacity-80">(edited)</span>}
                          <span>{timeFormatted}</span>
                          {isMe && renderStatusIcon(msg.status)}
                        </div>

                        {/* Edit / Delete action overlay on hover for my messages */}
                        {isMe && !isEditing && (
                          <div className="absolute -top-3.5 right-2 hidden group-hover:flex items-center space-x-1 bg-white border border-gray-200 rounded-md shadow-md px-1.5 py-0.5 z-10 text-gray-600">
                            <button
                              onClick={() => handleStartEdit(msg)}
                              title="Edit Message"
                              className="p-1 hover:text-zena-600 hover:bg-gray-100 rounded transition"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Delete Message"
                              className="p-1 hover:text-red-600 hover:bg-gray-100 rounded transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
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

        {/* Floating Telegram-Style Scroll to Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 z-20 p-2.5 bg-white text-gray-700 hover:text-zena-600 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center group active:scale-95"
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
              const displayCount = unreadCounts[activeConversationId] || unreadCountInView;
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

        {/* Message Compose Form */}
        <footer className="p-3 bg-white border-t border-gray-200">
          <form onSubmit={handleSend} className="flex items-center space-x-2">
            <input
              type="text"
              disabled={!activeConversationId}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeConversationId ? t('typeMessage') : 'Select or start a conversation to chat...'}
              className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-zena-500 focus:bg-white transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !activeConversationId}
              className="p-2.5 rounded-full bg-zena-600 text-white hover:bg-zena-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </div>

      {/* New Room Modal */}
      {showNewRoomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-base font-bold text-gray-800 mb-1">Create or Join a Room</h3>
            <p className="text-xs text-gray-500 mb-3">
              Enter a room name. If the room already exists, you will join it. It will only appear for users who join this room.
            </p>
            {roomError && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-700 rounded text-xs border border-red-200">
                {roomError}
              </div>
            )}
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Football Fans, Study Group"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRoomModal(false);
                    setRoomError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-base font-bold text-gray-800 mb-1">Start Direct Message</h3>
            <p className="text-xs text-gray-500 mb-3">Enter the username of the user you want to chat with.</p>
            {dmError && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-700 rounded text-xs border border-red-200">
                {dmError}
              </div>
            )}
            <form onSubmit={handleCreateDM} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="e.g. adnan_dev"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zena-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDmModal(false);
                    setDmError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
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
