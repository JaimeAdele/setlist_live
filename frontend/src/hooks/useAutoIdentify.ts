import { useEffect, useRef } from 'react';
import { useAudioCapture } from './useAudioCapture';

export type AutoStatus = 'idle' | 'listening' | 'processing' | 'match' | 'no_match' | 'error';

interface UseAutoIdentifyOptions {
  roomCode: string;
  eventActive: boolean;
  enabled: boolean;
  onStatusChange: (status: AutoStatus) => void;
}

const WAIT: Record<string, number> = {
  match: 60_000,
  duplicate: 30_000,
  lock_busy: 12_000,
  error: 10_000,
};

function delayForResult(type: string, streak: number): number {
  if (type === 'no_match') return Math.min(5_000 * Math.pow(2, streak - 1), 30_000);
  return WAIT[type] ?? 10_000;
}

export function useAutoIdentify({ roomCode, eventActive, enabled, onStatusChange }: UseAutoIdentifyOptions) {
  const { capture, cancel } = useAudioCapture();
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noMatchStreakRef = useRef(0);
  const cancelRecordingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!eventActive || !enabled) return;

    let killed = false;

    async function cycle() {
      if (killed) return;

      const lockRes = await fetch(`/api/rooms/${roomCode}/identify/lock`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => null);

      if (killed) return;

      if (!lockRes?.ok) {
        const resultType = lockRes?.status === 409 ? 'lock_busy' : 'error';
        scheduleNext(delayForResult(resultType, 0));
        return;
      }

      onStatusChange('listening');
      cancelRecordingRef.current = cancel;
      let blob: Blob;
      try {
        blob = await capture(8000);
      } catch {
        cancelRecordingRef.current = null;
        await fetch(`/api/rooms/${roomCode}/identify/lock`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => {});
        if (!killed) {
          onStatusChange('idle');
          scheduleNext(delayForResult('error', 0));
        }
        return;
      }
      cancelRecordingRef.current = null;

      if (killed) return;
      onStatusChange('processing');

      const form = new FormData();
      form.append('audio', blob, 'sample.webm');

      const res = await fetch(`/api/rooms/${roomCode}/identify`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      }).catch(() => null);

      if (killed) return;

      let resultType: string;
      if (!res) {
        resultType = 'error';
        onStatusChange('error');
      } else if (res.ok) {
        const song = await res.json();
        resultType = song.duplicate ? 'duplicate' : 'match';
        noMatchStreakRef.current = 0;
        onStatusChange('match');
      } else if (res.status === 422) {
        noMatchStreakRef.current += 1;
        resultType = 'no_match';
        onStatusChange('no_match');
      } else {
        resultType = 'error';
        onStatusChange('error');
      }

      if (!killed) {
        setTimeout(() => {
          if (!killed) onStatusChange('idle');
        }, 3000);
        scheduleNext(delayForResult(resultType, noMatchStreakRef.current));
      }
    }

    function scheduleNext(delayMs: number) {
      if (killed) return;
      autoTimerRef.current = setTimeout(() => {
        autoTimerRef.current = null;
        cycle();
      }, delayMs);
    }

    cycle();

    return () => {
      killed = true;
      cancelRecordingRef.current?.();
      cancelRecordingRef.current = null;
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [eventActive, enabled, roomCode]); // eslint-disable-line react-hooks/exhaustive-deps
}
