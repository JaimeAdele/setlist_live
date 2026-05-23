import { useState, useEffect } from 'react';
import { useCurrentUser } from './hooks/useCurrentUser';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const { user, isPrivileged, login, logout } = useCurrentUser();

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => setRooms(data.rooms));
  }, []);

  function handleRoomCreated(room: Room) {
    setRooms(prev => [...prev, room]);
  }

  async function handleRemoveEvent(roomId: string) {
    if (!window.confirm('Delete this event and all its songs? This cannot be undone.')) return;
    const res = await fetch(`/api/events/${roomId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) setRooms(prev => prev.filter(r => r.id !== roomId));
  }

  async function handleLogin(e: React.SubmitEvent) {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      setEmail('');
      setPassword('');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  }

  if (activeRoom) {
    return <RoomView room={activeRoom} onBack={() => setActiveRoom(null)} isPrivileged={isPrivileged} />;
  }

  return (
    <div className='min-h-screen bg-gray-950 flex flex-col items-center py-8 sm:py-12'>
      <div className='max-w-lg'>
        <h1 className='text-4xl font-bold text-white tracking-tight mb-1'>
          Vibe Check
        </h1>
        <p className='text-gray-400 mb-10'>Manage your events and rooms</p>

        {user ? (
          <div className='flex items-center justify-between mb-6 text-sm'>
            <span className='text-gray-400'>
              Signed in as <span className='text-accent'>{user.role}</span>
            </span>
            <button
              onClick={logout}
              className='text-gray-500 hover:text-white transition-colors cursor-pointer'
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className='flex flex-col gap-3 mb-8'>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Email'
              className='w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent
  transition-colors text-base sm:text-sm'
            />
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Password'
              className='w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent
  transition-colors text-base sm:text-sm'
            />
            <button
              type='submit'
              disabled={!email || !password}
              className='w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl 
  transition-colors text-sm cursor-pointer'
            >
              Sign in
            </button>
            {loginError && (
              <p className='text-red-400 text-sm text-center'>
                Invalid email or password
              </p>
            )}
          </form>
        )}

        <CreateRoomForm onRoomCreated={handleRoomCreated} />

        {rooms.length > 0 && (
          <div className='mt-10'>
            <h2 className='text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4'>
              Your Rooms
            </h2>
            <ul className='flex flex-col gap-3'>
              {rooms.map((room) => (
                <li key={room.id} className='flex items-stretch gap-2'>
                  <button
                    onClick={() => setActiveRoom(room)}
                    className='flex-1 flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors cursor-pointer'
                  >
                    <span className='text-white font-medium'>{room.name}</span>
                    <span className='text-xs font-mono bg-gray-800 text-accent px-3 py-1 rounded-full'>
                      {room.roomCode}
                    </span>
                  </button>
                  {isPrivileged && (
                    <button
                      onClick={() => handleRemoveEvent(room.id)}
                      className='self-stretch w-14 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer'
                      aria-label='Delete event'
                    >
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                        <line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>
                      </svg>
                    </button>
                  )}
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
