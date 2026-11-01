import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      appName: 'Zena Chat',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting to server...',
      offline: 'Offline — messages will send on reconnect',
      connected: 'Connected',
      typeMessage: 'Type a message...',
      send: 'Send',
      conversations: 'Conversations',
      noConversations: 'No conversations yet',
      sending: 'Sending...',
      sent: 'Sent',
      delivered: 'Delivered',
      read: 'Read',
      failed: 'Failed to send. Tap to retry.',
      outboxPending: '{{count}} message waiting in outbox',
      outboxPending_plural: '{{count}} messages waiting in outbox',
      language: 'Language',
      english: 'English',
      amharic: 'አማርኛ',
    },
  },
  am: {
    translation: {
      appName: 'ዜና ውይይት',
      connecting: 'በመገናኘት ላይ...',
      reconnecting: 'እንደገና በመገናኘት ላይ...',
      offline: 'መስመር ላይ አይደሉም — መልዕክቶች ሲገናኙ ይላካሉ',
      connected: 'ተገናኝቷል',
      typeMessage: 'መልዕክት ይጻፉ...',
      send: 'ላክ',
      conversations: 'ውይይቶች',
      noConversations: 'ምንም ውይይቶች የሉም',
      sending: 'በመላክ ላይ...',
      sent: 'ተልኳል',
      delivered: 'ደርሷል',
      read: 'ተነቧል',
      failed: 'መላክ አልተሳካም። እንደገና ለመሞከር ይጫኑ።',
      outboxPending: '{{count}} ያልተላከ መልዕክት አለ',
      outboxPending_plural: '{{count}} ያልተላኩ መልዕክቶች አሉ',
      language: 'ቋንቋ',
      english: 'English',
      amharic: 'አማርኛ',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('zena_lang') || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
