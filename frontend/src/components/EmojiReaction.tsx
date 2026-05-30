import { useState, useEffect } from 'react';

const EMOJIS = ['🔥', '❤️', '🥱', '🤮'] as const;
const VOTING_WINDOW_MS = 15 * 60 * 1000;

interface Props {
  songId: string;
  identifiedAt: string;
  breakdown: Record<string, number>;
}

function EmojiReaction({ songId, identifiedAt, breakdown }: Props) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(
    () => Date.now() - new Date(identifiedAt).getTime() < VOTING_WINDOW_MS
  );

  useEffect(() => {
    if (!windowOpen) return;
    const remaining = VOTING_WINDOW_MS - (Date.now() - new Date(identifiedAt).getTime());
    if (remaining <= 0) { setWindowOpen(false); return; }
    const timer = setTimeout(() => setWindowOpen(false), remaining);
    return () => clearTimeout(timer);
  }, [identifiedAt]);

  async function handleReact(emoji: string) {
    if (!windowOpen) return;
    setSelectedEmoji(emoji);
    await fetch(`/api/songs/${songId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emoji }),
    });
  }

  return (
    <div className='flex items-center gap-1 mt-2'>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
          disabled={!windowOpen}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all select-none ${
            windowOpen
              ? selectedEmoji === emoji
                ? 'bg-gray-700 ring-1 ring-gray-500 scale-110 cursor-pointer'
                : 'hover:bg-gray-800 cursor-pointer'
              : 'opacity-50 cursor-default'
          }`}
        >
          <span className='text-base'>{emoji}</span>
          <span className='text-xs text-gray-400'>{breakdown[emoji] ?? 0}</span>
        </button>
      ))}
      {!windowOpen && (
        <span className='ml-1 text-xs text-gray-600'>· closed</span>
      )}
    </div>
  );
}

export default EmojiReaction;
