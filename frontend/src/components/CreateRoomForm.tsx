import { useState } from 'react';

interface Room {
  id: string;
  name: string;
  roomCode: string;
}

interface CreateRoomFormProps {
  onRoomCreated: (room: Room) => void;
}

function CreateRoomForm({ onRoomCreated }: CreateRoomFormProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      credentials: 'include',
    });

    const room = await res.json();
    setLoading(false);
    setName('');
    onRoomCreated(room);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Room name (e.g. Saturday Night)"
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors text-base sm:text-sm"
      />
      <button
        type="submit"
        disabled={loading || !name}
        className="w-full sm:w-auto bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
    </form>
  );
}

export default CreateRoomForm;
