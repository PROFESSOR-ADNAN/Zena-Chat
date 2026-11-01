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
} from 'lucide-react';
import { db, LocalMessage } from './db';
import { syncEngine, ConnectionState } from './sync/engine';

export default function App() {
  const { t, i18n } = useTranslation();
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [activeConversationId] = useState<string>('default-conv');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reactive IndexedDB queries
  const messages = useLiveQuery(
    () =>
      db.messages
        .where('conversationId')
        .equals(activeConversationId)
        .sortBy('createdAt'),
    [activeConversationId]
  );

  const pendingOutboxCount = useLiveQuery(() => db.outbox.count()) || 0;

  useEffect(() => {
    // Demo dev auth token for initial mount
    const demoToken = localStorage.getItem('zena_token') || 'demo_dev_token';
    syncEngine.init(demoToken);

    const unsubscribe = syncEngine.onStateChange((state) => {
      setConnectionState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    await syncEngine.sendMessage(activeConversationId, text);
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

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-xl overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-zena-700 text-white px-4 py-3 flex items-center justify-between border-b border-zena-800">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-6 h-6 text-zena-100" />
          <h1 className="text-xl font-bold tracking-tight">{t('appName')}</h1>
        </div>

        <div className="flex items-center space-x-3">
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

      {/* Chat Messages View */}
      <main className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
        {(!messages || messages.length === 0) && (
          <div className="text-center py-20 text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('noConversations')}</p>
          </div>
        )}

        {messages?.map((msg) => {
          const isMe = msg.senderId === 'self';
          const timeFormatted = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Addis_Ababa',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(msg.createdAt));

          return (
            <div
              key={msg.id || msg.clientMsgId}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm relative ${
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
                <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <div
                  className={`text-[10px] mt-1 flex items-center justify-end space-x-1 ${
                    isMe ? 'text-green-100' : 'text-gray-400'
                  }`}
                >
                  <span>{timeFormatted}</span>
                  {isMe && renderStatusIcon(msg.status)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Message Compose Form */}
      <footer className="p-3 bg-white border-t border-gray-200">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('typeMessage')}
            className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-zena-500 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full bg-zena-600 text-white hover:bg-zena-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
