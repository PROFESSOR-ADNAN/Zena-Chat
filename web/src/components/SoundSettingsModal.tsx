import { useState } from 'react';
import { X, Volume2, VolumeX, Bell, Check } from 'lucide-react';

interface SoundSettingsModalProps {
  onClose: () => void;
}

export function playCustomChime(type = 'default', volume = 0.5) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, volume * 0.3)), now);
    gain.connect(ctx.destination);

    if (type === 'bell') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'pop') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'digital') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.06);
      gain.gain.setValueAtTime(Math.min(1, Math.max(0, volume * 0.15)), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      // Default harmonic chime
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {}
}

export default function SoundSettingsModal({ onClose }: SoundSettingsModalProps) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('zena_sound') !== 'false');
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('zena_volume') || '0.5'));
  const [chime, setChime] = useState(() => localStorage.getItem('zena_chime') || 'default');

  const handleToggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('zena_sound', String(next));
    if (next) playCustomChime(chime, volume);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    localStorage.setItem('zena_volume', String(val));
  };

  const handleSelectChime = (type: string) => {
    setChime(type);
    localStorage.setItem('zena_chime', type);
    if (enabled) {
      playCustomChime(type, volume);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-zena-600" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">Sound & Notifications</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toggle On/Off */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            {enabled ? (
              <Volume2 className="w-4 h-4 text-zena-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400" />
            )}
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Message Sound Alert
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Play sound for incoming messages
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              enabled ? 'bg-zena-600' : 'bg-gray-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Volume Slider */}
        {enabled && (
          <div className="space-y-1.5 px-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-300">Volume</span>
              <span className="text-gray-400 font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-slate-700 accent-zena-600"
            />
          </div>
        )}

        {/* Chime Tones */}
        {enabled && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Notification Chime Tone
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'default', label: 'Harmonic' },
                { id: 'bell', label: 'Crystal Bell' },
                { id: 'pop', label: 'Subtle Pop' },
                { id: 'digital', label: 'Digital Beep' },
              ].map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => handleSelectChime(tone.id)}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                    chime === tone.id
                      ? 'border-zena-600 bg-zena-50 dark:bg-zena-950/40 text-zena-700 dark:text-zena-300'
                      : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{tone.label}</span>
                  {chime === tone.id && <Check className="w-3.5 h-3.5 text-zena-600" />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zena-600 text-white rounded-xl text-xs font-semibold hover:bg-zena-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
