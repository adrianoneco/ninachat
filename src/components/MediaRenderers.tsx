import React from 'react';
import { Download, FileText, Play as PlayIcon, Pause as PauseIcon } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { MessageDirection } from '@/types';

/* ── Image Message ───────────────────────────────── */
export const MessageImage: React.FC<{ mediaUrl?: string | null; content?: string; direction?: MessageDirection }> = ({ mediaUrl, content }) => {
  const src = useMediaUrl(mediaUrl) || content;
  return (
    <div className="mb-1 group relative">
      <img
        src={src || ''}
        alt="Anexo"
        className="rounded-lg max-w-full h-auto max-h-72 object-cover border border-gray-300/50 dark:border-slate-700/50 shadow-lg"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://placehold.co/300x200/1e293b/cbd5e1?text=Erro+Imagem';
        }}
      />
    </div>
  );
};

/* ── Video Message ───────────────────────────────── */
export const MessageVideo: React.FC<{ mediaUrl?: string | null; content?: string }> = ({ mediaUrl, content }) => {
  const src = useMediaUrl(mediaUrl) || content;
  return (
    <div className="mb-1">
      <video
        src={src || ''}
        controls
        preload="metadata"
        className="rounded-lg max-w-full max-h-72 border border-gray-300/50 dark:border-slate-700/50 shadow-lg"
        onError={(e) => {
          const el = e.currentTarget;
          el.poster = 'https://placehold.co/300x200/1e293b/cbd5e1?text=Erro+Video';
        }}
      />
    </div>
  );
};

/* ── Sticker Message ─────────────────────────────── */
export const MessageSticker: React.FC<{ mediaUrl?: string | null; content?: string }> = ({ mediaUrl, content }) => {
  const src = useMediaUrl(mediaUrl) || content;
  return (
    <div className="mb-1">
      <img
        src={src || ''}
        alt="Sticker"
        className="max-w-[180px] max-h-[180px] object-contain"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://placehold.co/180x180/1e293b/cbd5e1?text=Sticker';
        }}
      />
    </div>
  );
};

/* ── File / Document Message ─────────────────────── */
export const MessageFile: React.FC<{ mediaUrl?: string | null; content?: string; direction?: MessageDirection }> = ({ mediaUrl, content, direction }) => {
  const src = useMediaUrl(mediaUrl);
  const fileName = content || 'Documento';
  const isOutgoing = direction === MessageDirection.OUTGOING;
  return (
    <a
      href={src || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
        isOutgoing
          ? 'border-white/20 hover:bg-white/10'
          : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
      }`}
    >
      <FileText className="w-8 h-8 flex-shrink-0 opacity-70" />
      <span className="flex-1 text-sm truncate max-w-[200px]">{fileName}</span>
      <Download className="w-4 h-4 opacity-50" />
    </a>
  );
};

/**
 * Wrapper that resolves a storage mediaUrl to a presigned URL for audio.
 * Returns resolved src (or original) so the parent can pass it to the <audio> element.
 */
export const useResolvedAudioSrc = (mediaUrl: string | null | undefined): string | null => {
  return useMediaUrl(mediaUrl);
};

/* ── Audio Message (self-contained player with presigned URL resolution) ─── */
export const MessageAudio: React.FC<{
  msgId: string;
  mediaUrl?: string | null;
  direction?: MessageDirection;
  audioRefs: React.MutableRefObject<Record<string, HTMLAudioElement>>;
  playingAudioId: string | null;
  setPlayingAudioId: (id: string | null) => void;
  audioDurations: Record<string, number>;
  setAudioDurations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  audioProgress: Record<string, number>;
  setAudioProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  formatAudioTime: (t: number) => string;
}> = ({ msgId, mediaUrl, direction, audioRefs, playingAudioId, setPlayingAudioId, audioDurations, setAudioDurations, audioProgress, setAudioProgress, formatAudioTime }) => {
  const src = useMediaUrl(mediaUrl);
  const isPlaying = playingAudioId === msgId;
  const duration = audioDurations[msgId] || 0;
  const progress = audioProgress[msgId] || 0;
  const isOutgoing = direction === MessageDirection.OUTGOING;

  const togglePlay = () => {
    const audio = audioRefs.current[msgId];
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      Object.values(audioRefs.current).forEach(a => a.pause());
      audio.play();
      setPlayingAudioId(msgId);
    }
  };

  return (
    <div className="flex items-center gap-3 min-w-[220px] py-1">
      {src && (
        <audio
          ref={el => { if (el) audioRefs.current[msgId] = el; }}
          src={src}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            setAudioDurations(prev => ({ ...prev, [msgId]: audio.duration }));
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            setAudioProgress(prev => ({ ...prev, [msgId]: audio.currentTime }));
          }}
          onEnded={() => setPlayingAudioId(null)}
        />
      )}
      <button
        onClick={togglePlay}
        disabled={!src}
        className={`flex items-center justify-center w-9 h-9 rounded-full transition-all shadow-md ${
          isOutgoing
            ? 'bg-white dark:bg-slate-950 text-primary hover:bg-primary/5 disabled:opacity-50'
            : 'bg-primary text-white dark:text-white hover:bg-primary/90 disabled:opacity-50'
        }`}
      >
        {isPlaying ? (
          <PauseIcon className="w-3.5 h-3.5 fill-current" />
        ) : (
          <PlayIcon className="w-3.5 h-3.5 ml-0.5 fill-current" />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1 justify-center h-9">
        <div
          className={`h-1.5 rounded-full overflow-hidden cursor-pointer ${
            isOutgoing ? 'bg-white/30' : 'bg-gray-300 dark:bg-slate-600'
          }`}
          onClick={(e) => {
            const audio = audioRefs.current[msgId];
            if (!audio || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audio.currentTime = percent * duration;
          }}
        >
          <div
            className={`h-full rounded-full transition-all ${
              isOutgoing ? 'bg-white' : 'bg-primary/40'
            }`}
            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <span className={`text-[10px] font-medium ${
          isOutgoing ? 'text-primary/90' : 'text-gray-500 dark:text-slate-400'
        }`}>
          {formatAudioTime(progress)} / {formatAudioTime(duration)}
        </span>
      </div>
    </div>
  );
};
