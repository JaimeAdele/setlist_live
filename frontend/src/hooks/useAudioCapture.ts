export function useAudioCapture() {
  async function capture(durationMs: number): Promise<Blob> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    const chunks: Blob[] = [];

    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: 'audio/webm' }));
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        reject(new Error('Recording failed'));
      };

      recorder.start();
      setTimeout(() => recorder.stop(), durationMs);
    });
  }

  return { capture };
}
