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
}

const ACTIVE_STATES: IdentifyState[] = ['listening', 'processing'];

function IdentifyButton({ eventId }: Props) {
  const [state, setState] = useState<IdentifyState>('idle');
  const [match, setMatch] = useState<Song | null>(null);
  const { capture } = useAudioCapture();

  async function handleClick() {
    if (ACTIVE_STATES.includes(state)) return;

    setState('listening');

    try {
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
      } else if (res.status === 409) {
        setState('error');
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

  const label: Record<IdentifyState, string> = {
    idle: 'Identify Song',
    listening: 'Listening...',
    processing: 'Identifying...',
    match: match ? `${match.title} — ${match.artist}` : 'Match found',
    no_match: 'No match found',
    error: 'Something went wrong',
  };

  const disabled = ACTIVE_STATES.includes(state);

  return (
    <button onClick={handleClick} disabled={disabled}>
      {label[state]}
    </button>
  );
}

export default IdentifyButton;
