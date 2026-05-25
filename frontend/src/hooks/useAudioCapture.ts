import { useRef } from 'react';

function getSupportedMimeType(): string {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function useAudioCapture() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function capture(durationMs: number): Promise<Blob> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    cancelledRef.current = false;
    const chunks: Blob[] = [];

    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        if (cancelledRef.current) {
          reject(new DOMException('Cancelled by user', 'AbortError'));
        } else {
          resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        }
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        reject(new Error('Recording failed'));
      };

      recorder.start();
      timeoutRef.current = setTimeout(() => recorder.stop(), durationMs);
    });
  }

  function cancel() {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }

  return { capture, cancel };
}
