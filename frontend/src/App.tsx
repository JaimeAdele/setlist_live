import { useState, useEffect } from 'react';
import CreateRoomForm from './components/CreateRoomForm';
import RoomView from './components/RoomView';

interface Room {
  id: string;
  name: string;
  roomCode: string;
}

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => setRooms(data.rooms));
  }, []);

  function handleRoomCreated(room: Room) {
    setRooms(prev => [...prev, room]);
  }

  if (activeRoom) {
    return <RoomView room={activeRoom} onBack={() => setActiveRoom(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center py-8 sm:py-12">
      <div className="max-w-lg">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-1">Vibe Check</h1>
        <p className="text-gray-400 mb-10">Manage your events and rooms</p>

        <CreateRoomForm onRoomCreated={handleRoomCreated} />

        {rooms.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              Your Rooms
            </h2>
            <ul className="flex flex-col gap-3">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    onClick={() => setActiveRoom(room)}
                    className="w-full flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors cursor-pointer"
                  >
                    <span className="text-white font-medium">{room.name}</span>
                    <span className="text-xs font-mono bg-gray-800 text-accent px-3 py-1 rounded-full">
                      {room.roomCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
