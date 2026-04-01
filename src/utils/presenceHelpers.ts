/**
 * Presence status helpers
 * Maps presence values from backend to UI representations (colors, labels, text)
 */

export type PresenceStatus = 'available' | 'unavailable' | 'composing' | 'recording' | 'paused' | null;

/**
 * Get Tailwind CSS class for presence dot indicator
 * @param presense - Presence status from backend
 * @returns Tailwind CSS class string for the dot color
 */
export const getPresenceDotColor = (presense: PresenceStatus): string => {
  if (!presense) return 'bg-gray-400';
  if (presense === 'available') return 'bg-emerald-500';
  if (presense === 'composing' || presense === 'recording') return 'bg-amber-400 animate-pulse';
  if (presense === 'paused') return 'bg-yellow-400';
  if (presense === 'unavailable') return 'bg-gray-400';
  return 'bg-gray-400';
};

/**
 * Get human-readable label for presence status
 * @param presense - Presence status from backend
 * @returns Human-readable string
 */
export const getPresenceLabel = (presense: PresenceStatus): string => {
  if (!presense) return '';
  if (presense === 'available') return 'Online';
  if (presense === 'composing') return 'Digitando...';
  if (presense === 'recording') return 'Gravando áudio...';
  if (presense === 'paused') return 'Parou de digitar';
  if (presense === 'unavailable') return 'Offline';
  return '';
};

/**
 * Get colored status text class for presence
 * @param presense - Presence status from backend
 * @returns Tailwind CSS class for the status text
 */
export const getPresenceStatusTextClass = (presense: PresenceStatus): string => {
  if (!presense) return '';
  if (presense === 'available') return 'text-emerald-400';
  if (presense === 'composing') return 'text-amber-400 animate-pulse';
  if (presense === 'recording') return 'text-amber-400 animate-pulse';
  if (presense === 'paused') return 'text-yellow-400';
  if (presense === 'unavailable') return 'text-gray-400';
  return '';
};

/**
 * Presence color mapping for UI elements
 */
export const PRESENCE_COLORS = {
  available: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
    label: 'Online',
  },
  unavailable: {
    dot: 'bg-gray-400',
    text: 'text-gray-400',
    label: 'Offline',
  },
  composing: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-400',
    label: 'Digitando...',
  },
  recording: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-400',
    label: 'Gravando áudio...',
  },
  paused: {
    dot: 'bg-yellow-400',
    text: 'text-yellow-400',
    label: 'Parou de digitar',
  },
} as const;

