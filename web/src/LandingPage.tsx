import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Zap,
  WifiOff,
  Shield,
  Users,
  CheckCheck,
  Globe,
  ArrowRight,
  Sparkles,
  Server,
  Clock,
  Terminal,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onDemoLogin: () => void;
  authLoading: boolean;
  onToggleLanguage: () => void;
  currentLang: string;
}

export default function LandingPage({
  onOpenAuth,
  onDemoLogin,
  authLoading,
  onToggleLanguage,
  currentLang,
}: LandingPageProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-zena-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-zena-700 via-zena-600 to-emerald-400 p-0.5 shadow-lg shadow-zena-900/40 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-emerald-300">
                  {t('appName')}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Resilient Real-Time Chat</p>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              {t('features')}
            </a>
            <a href="#architecture" className="hover:text-emerald-400 transition-colors">
              {t('architecture')}
            </a>
            <a
              href="https://github.com/PROFESSOR-ADNAN/Zena-Chat"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
            >
              <span>{t('openSource')}</span>
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Language Switcher */}
            <button
              onClick={onToggleLanguage}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors flex items-center space-x-1.5"
              title="Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentLang === 'en' ? 'አማርኛ' : 'EN'}</span>
            </button>

            {/* Sign In */}
            <button
              onClick={() => onOpenAuth('login')}
              className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-white px-3 py-1.5 transition-colors hidden sm:block"
            >
              {t('signIn')}
            </button>

            {/* Get Started / Register */}
            <button
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-zena-600 to-emerald-500 hover:from-zena-500 hover:to-emerald-400 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 hover:shadow-emerald-900/60 active:scale-95 transition-all flex items-center space-x-1.5"
            >
              <span>{t('register')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Glow & Mesh Background Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-600/20 via-zena-600/15 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-8 shadow-inner shadow-emerald-500/10 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t('heroBadge')}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-normal">Socket.IO + Redis + MongoDB</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-[1.12]">
            <span className="block text-white">{t('heroHeadline')}</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            {t('heroSubtitle')}
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-zena-600 to-emerald-500 hover:from-zena-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>{t('startChatting')}</span>
            </button>

            <button
              onClick={onDemoLogin}
              disabled={authLoading}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{authLoading ? 'Signing In...' : t('quickDemo')}</span>
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>No Phone Number Required</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero Message Drops</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Free & Open Source</span>
            </div>
          </div>

          {/* Interactive Chat Mockup Showcase */}
          <div className="mt-16 sm:mt-20 max-w-4xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-emerald-950/30 overflow-hidden text-left relative">
            {/* Window Topbar */}
            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-400 font-medium ml-2 hidden sm:inline">
                  Zena Chat — General Chat
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>42 Members • 14 Online</span>
                </span>
              </div>
            </div>

            {/* Offline-First Banner Demonstration */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Offline-First Engine: Local IndexedDB Outbox Active</span>
              </div>
              <span className="text-amber-400/80 text-[11px] hidden sm:inline">Zero Message Loss Guarantee</span>
            </div>

            {/* Mock Chat Viewport */}
            <div className="p-4 sm:p-6 space-y-4 bg-slate-950/60 min-h-[320px] flex flex-col justify-end">
              {/* Message from another user */}
              <div className="flex items-start space-x-3 max-w-[85%] sm:max-w-[70%]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  AB
                </div>
                <div className="bg-slate-800 border border-slate-700/60 rounded-2xl rounded-tl-xs p-3 shadow-md">
                  <p className="text-xs font-semibold text-emerald-400 mb-0.5">Abdullah</p>
                  <p className="text-xs sm:text-sm text-slate-200">
                    Welcome to Zena! I just sent this over a 3G tunnel and it delivered smoothly with zero lag.
                  </p>
                  <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-slate-400">
                    <span>11:42 AM</span>
                  </div>
                </div>
              </div>

              {/* Telegram-style Unread Separator Bar in Mock */}
              <div className="my-2 flex items-center justify-center space-x-3 text-xs select-none">
                <div className="flex-1 border-t border-emerald-500/30" />
                <span className="px-3.5 py-1 bg-emerald-950/80 text-emerald-300 font-bold rounded-full text-[11px] tracking-wide flex items-center gap-1.5 border border-emerald-500/40 shadow-sm backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Unread Messages (10)</span>
                </span>
                <div className="flex-1 border-t border-emerald-500/30" />
              </div>

              {/* Message from current user */}
              <div className="flex items-end justify-end space-x-2 self-end max-w-[85%] sm:max-w-[70%]">
                <div className="bg-zena-700 text-white rounded-2xl rounded-br-xs p-3 shadow-md">
                  <p className="text-xs sm:text-sm">
                    Awesome! The unread counter decrements in real-time as I scroll down, just like Telegram! 🚀
                  </p>
                  <div className="flex items-center justify-end space-x-1.5 mt-1 text-[10px] text-emerald-200">
                    <span>11:43 AM</span>
                    <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Bottom Input Bar */}
            <div className="bg-slate-900 p-3 border-t border-slate-800 flex items-center space-x-3">
              <input
                type="text"
                disabled
                placeholder="Type a message... (instant offline queuing enabled)"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-300 placeholder-slate-500 cursor-default"
              />
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 bg-zena-600 hover:bg-zena-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="py-20 bg-slate-900/50 border-t border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2">
              {t('features')}
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t('featuresTitle')}
            </h3>
            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
              {t('featuresSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <WifiOff className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('offlineFeatureTitle')}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{t('offlineFeatureDesc')}</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('telegramFeatureTitle')}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{t('telegramFeatureDesc')}</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('groupsFeatureTitle')}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{t('groupsFeatureDesc')}</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Server className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('scaleFeatureTitle')}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{t('scaleFeatureDesc')}</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('privacyFeatureTitle')}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{t('privacyFeatureDesc')}</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/20 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('bilingualFeatureTitle')}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{t('bilingualFeatureDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Highlights Section */}
      <section id="architecture" className="py-20 border-t border-slate-800/80 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
                <Terminal className="w-3.5 h-3.5" />
                <span>Production Architecture</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Built to Withstand Connection Flapping & High Latency
              </h3>
              <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
                Standard WebSocket chats drop messages when users disconnect. Zena uses a formal distributed
                synchronization protocol:
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start space-x-3.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">Monotonic Sequence Ordering (`seq`)</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Server-assigned atomic sequence numbers per conversation guarantee strict total ordering. Client clocks are never trusted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">Idempotent Delivery & UUID deduplication</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Messages carry a client-generated UUID persisted with a compound unique index. Reconnecting clients never produce duplicate messages.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">Redis 7 Distributed Socket Adapter</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Clustered across 3 gateway replicas with cross-node broadcast and sub-second presence reconciliation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics & Architecture Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center justify-between">
                <span>System Benchmarks</span>
                <span className="text-emerald-400 font-semibold">Active Production Cluster</span>
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <span className="text-2xl sm:text-3xl font-black text-white">3 Replicas</span>
                  <p className="text-xs text-slate-400 mt-1">Socket.IO Load-Balanced</p>
                </div>
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">&lt; 50ms</span>
                  <p className="text-xs text-slate-400 mt-1">Real-Time Message Latency</p>
                </div>
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">100%</span>
                  <p className="text-xs text-slate-400 mt-1">Offline Outbox Reliability</p>
                </div>
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <span className="text-2xl sm:text-3xl font-black text-white">0 Drops</span>
                  <p className="text-xs text-slate-400 mt-1">Idempotent Deduplication</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>East Africa / Ethiopia Low-Bandwidth Tuning</span>
                </div>
                <span className="text-slate-500">MERN Stack</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-gradient-to-b from-slate-950 to-slate-900 border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-zena-900/60 via-slate-900 to-emerald-950/60 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {t('ctaTitle')}
              </h3>
              <p className="mt-4 text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
                {t('ctaSubtitle')}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-zena-600 to-emerald-500 hover:from-zena-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 active:scale-95 transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>{t('startChatting')}</span>
                </button>
                <button
                  onClick={onDemoLogin}
                  disabled={authLoading}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-sm active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>{authLoading ? 'Signing In...' : t('quickDemo')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-300">{t('appName')}</span>
            <span>•</span>
            <span>Resilient Real-Time Chat</span>
          </div>

          <div className="flex items-center space-x-6">
            <a
              href="https://github.com/PROFESSOR-ADNAN/Zena-Chat"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition"
            >
              GitHub Repository
            </a>
            <span className="text-slate-600">|</span>
            <span>MIT License</span>
            <span className="text-slate-600">|</span>
            <button onClick={onToggleLanguage} className="hover:text-emerald-400 transition">
              {currentLang === 'en' ? 'አማርኛ' : 'English'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
