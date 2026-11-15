import { useState, useEffect, useRef } from 'react';
import { Trash2, Send } from 'lucide-react';

interface AudioRecorderProps {
  onSend: (audioBase64: string, durationSeconds: number) => void;
  onCancel: () => void;
}

export default function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startRecording() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(100);

        timerRef.current = setInterval(() => {
          setSeconds((s) => s + 1);
        }, 1000);
      } catch (err: any) {
        console.error('Microphone error:', err);
        setError('Microphone access denied or unavailable.');
      }
    }

    startRecording();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        onSend(base64data, seconds);
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (error) {
    return (
      <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-2 rounded-xl text-xs w-full">
        <span>{error}</span>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 rounded font-semibold transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-zena-50 dark:bg-slate-800 border border-zena-200 dark:border-slate-700 px-4 py-2 rounded-xl w-full select-none animate-in fade-in duration-150">
      <div className="flex items-center space-x-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-100">
          {formatTime(seconds)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
          Recording voice note...
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onCancel}
          title="Discard Recording"
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-full transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleFinish}
          title="Send Voice Note"
          className="p-2 rounded-full bg-zena-600 hover:bg-zena-700 text-white shadow-sm transition transform hover:scale-105 active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
