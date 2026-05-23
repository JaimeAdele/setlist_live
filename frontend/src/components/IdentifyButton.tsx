import { useState } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';

type IdentifyState = 'idle' | 'listening' | 'processing' | 'match' | 'no_match' | 'error';

interface Song {
  id: string;
  title: string;
  artist: string;
}

interface Props {
  eventId: string;
  roomLocked: boolean;
}

const ACTIVE_STATES: IdentifyState[] = ['listening', 'processing'];

function IdentifyButton({ eventId, roomLocked }: Props) {
  const [state, setState] = useState<IdentifyState>('idle');
  const [match, setMatch] = useState<Song | null>(null);
  const { capture } = useAudioCapture();

  async function handleClick() {
    if (ACTIVE_STATES.includes(state) || roomLocked) return;

    try {
      const reserveRes = await fetch(`/api/events/${eventId}/identify/reserve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!reserveRes.ok) {
        setState('error');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      setState('listening');
      const blob = await capture(8000);
      setState('processing');

      const form = new FormData();
      form.append('audio', blob, 'sample.webm');

      const res = await fetch(`/api/events/${eventId}/identify`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });

      if (res.ok) {
        const song: Song = await res.json();
        setMatch(song);
        setState('match');
        setTimeout(() => setState('idle'), 5000);
      } else if (res.status === 422) {
        setState('no_match');
        setTimeout(() => setState('idle'), 3000);
      } else {
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      }
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const isActive = ACTIVE_STATES.includes(state) || roomLocked;

  const config: Record<IdentifyState, { label: string; style: string }> = {
    idle: {
      label: roomLocked ? 'Identifying...' : 'Identify Song',
      style: 'bg-accent hover:bg-accent-hover text-black',
    },
    listening: {
      label: 'Listening...',
      style: 'bg-accent text-black animate-pulse',
    },
    processing: {
      label: 'Identifying...',
      style: 'bg-gray-700 text-white',
    },
    match: {
      label: match ? `${match.title} — ${match.artist}` : 'Match found',
      style: 'bg-gray-800 text-accent',
    },
    no_match: {
      label: 'No match found',
      style: 'bg-gray-800 text-gray-400',
    },
    error: {
      label: 'Something went wrong',
      style: 'bg-gray-800 text-red-400',
    },
  };

  const { label, style } = config[state];

  return (
    <button
      onClick={handleClick}
      disabled={isActive}
      className={`w-full py-4 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:cursor-not-allowed ${style}`}
    >
      {label}
    </button>
  );
}

export default IdentifyButton;
