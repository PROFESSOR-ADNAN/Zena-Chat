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
      heroBadge: 'Ultra-Resilient Real-Time Chat',
      heroHeadline: 'Instant, Resilient Messaging Built for Every Network',
      heroSubtitle:
        'Engineered with offline-first local queue, multi-node distributed pub/sub, Telegram-style unread tracking, and guaranteed zero message loss.',
      startChatting: 'Start Chatting Now',
      quickDemo: 'One-Click Demo Guest',
      signIn: 'Sign In',
      register: 'Create Account',
      features: 'Features',
      architecture: 'Architecture',
      openSource: 'Open Source',
      offlineFeatureTitle: 'Offline-First Resilience',
      offlineFeatureDesc:
        'Durable IndexedDB outbox queue. Type messages anywhere, even offline — they auto-send the second you reconnect.',
      telegramFeatureTitle: 'Telegram-Style Unread Sync',
      telegramFeatureDesc:
        'Sticky unread separator bar, live decreasing counters on scroll, and persistent reading cursors across devices.',
      groupsFeatureTitle: 'Public Rooms & Direct DMs',
      groupsFeatureDesc:
        'Join General Chat, create custom group channels, or private 1-on-1 chats with real-time member presence.',
      scaleFeatureTitle: 'Distributed Scale (3x Replicas)',
      scaleFeatureDesc:
        'Multi-node Socket.IO gateway with Redis 7 adapter, atomic sequence counters, and idempotent writes.',
      privacyFeatureTitle: 'Privacy & Per-User Purge',
      privacyFeatureDesc:
        'Delete chats for your account anytime. Conversations permanently wipe from the database when the last member deletes.',
      bilingualFeatureTitle: 'Native Bilingual Support',
      bilingualFeatureDesc:
        'Full support for English and Amharic (አማርኛ) with culturally intuitive typography and responsive layouts.',
      ctaTitle: 'Ready to Experience Resilient Communication?',
      ctaSubtitle: 'Join thousands of users chatting with zero dropped messages on any device.',
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
      heroBadge: 'ለማንኛውም የኔትወርክ ሁኔታ የተሰራ',
      heroHeadline: 'ፈጣን፣ አስተማማኝ እና ዘመናዊ መልዕክት መለዋወጫ',
      heroSubtitle:
        'ኢንተርኔት ቢቋረጥም እንኳን መልዕክቶችን በስልክዎ አስቀምጦ ሲገናኙ በራስ-ሰር የሚልክ፣ በቴሌግራም ስልት የተዘጋጀ አስተማማኝ የመልዕክት መድረክ።',
      startChatting: 'ውይይት ይጀምሩ',
      quickDemo: 'በአንድ ጠቅታ በነፃ ይሞክሩ',
      signIn: 'ግባ',
      register: 'አካውንት ክፈት',
      features: 'ባህሪያት',
      architecture: 'መዋቅር',
      openSource: 'ክፍት ምንጭ',
      offlineFeatureTitle: 'ኢንተርኔት ቢቋረጥም አይቆምም',
      offlineFeatureDesc:
        'መልዕክቶች በአካባቢ ማህደረ ትውስታ ውስጥ ተቀምጠው መስመር ሲገኝ ወዲያውኑ ይደርሳሉ። ምንም መልዕክት አይጠፋም።',
      telegramFeatureTitle: 'እንደ ቴሌግራም ያልተነበቡ መልዕክቶች',
      telegramFeatureDesc:
        'ያልተነበቡ መልዕክቶችን ለይቶ የሚያሳይ መስመር፣ ወደ ታች ሲሸበለሉ ቁጥሩ የሚቀንስበት እና የቀሩበትን የሚያስታውስ አሰራር።',
      groupsFeatureTitle: 'የቡድን እና የግል ውይይቶች',
      groupsFeatureDesc:
        'በአጠቃላይ ውይይት ይሳተፉ፣ አዲስ የቡድን ክፍሎችን ይፍጠሩ፣ ወይም በግል ያወሩ — የቀጥታ አባላት እና ኦንላይን መረጃ ጋር።',
      scaleFeatureTitle: 'ከፍተኛ ፍጥነት እና ጥንካሬ',
      scaleFeatureDesc:
        'በሶስት ጌትዌይ ሰርቨሮች እና ሬዲስ የተገነባ፣ ምንም መልዕክት የማይደገምበት እና እጅግ ፈጣን አሰራር።',
      privacyFeatureTitle: 'የግል ውይይት ጥበቃ',
      privacyFeatureDesc:
        'ውይይትን ለራስዎ ብቻ መሰረዝ ይችላሉ። የመጨረሻው ተጠቃሚ ሲሰርዝ ግን ውይይቱ ከዳታቤዝ ሙሉ በሙሉ ይጠፋል።',
      bilingualFeatureTitle: 'በአማርኛ እና በእንግሊዝኛ',
      bilingualFeatureDesc:
        'በቀላሉ በአማርኛ ወይም በእንግሊዝኛ ቋንቋ መጠቀም የሚያስችል ምቹ እና ውብ ገጽታ።',
      ctaTitle: 'አስተማማኝ ግንኙነትን ለመጀመር ዝግጁ ነዎት?',
      ctaSubtitle: 'አሁኑኑ በነፃ ይመዝገቡ ወይም በአንድ ጠቅታ ሳያካውንት ይሞክሩት።',
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
