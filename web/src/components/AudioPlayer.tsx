import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isMe?: boolean;
}

export default function AudioPlayer({ src, isMe = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / (audio.duration || 1)) * 100);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTo = (Number(e.target.value) / 100) * (audio.duration || 0);
    audio.currentTime = seekTo;
    setProgress(Number(e.target.value));
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center space-x-2.5 py-1 min-w-[200px] max-w-xs ${isMe ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition active:scale-95 ${
          isMe
            ? 'bg-white text-zena-700 hover:bg-gray-100'
            : 'bg-zena-600 text-white hover:bg-zena-700'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSeek}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-black/20 accent-current"
        />
        <div className="flex justify-between text-[10px] opacity-75 mt-1 font-mono">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>
      </div>
    </div>
  );
}
