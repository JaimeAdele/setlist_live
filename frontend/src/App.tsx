import { useState, useEffect } from 'react';
import CreateRoomForm from './components/CreateRoomForm';

interface Room {
  id: string;
  name: string;
  roomCode: string;
}

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => setRooms(data.rooms));
  }, []);

  function handleRoomCreated(room: Room) {
    setRooms(prev => [...prev, room]);
  }

  return (
    <div>
      <h1>Setlist Live - Admin</h1>
      <CreateRoomForm onRoomCreated={handleRoomCreated} />
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            {room.name} — code: <strong>{room.roomCode}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;