import { useState, useEffect } from 'react';
import { useRoomSocket } from '../hooks/useRoomSocket';
import IdentifyButton from './IdentifyButton';

interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string | null;
  spotifyId: string | null;
  identifiedAt: string;
}

interface Room {
  id: string;
  name: string;
  roomCode: string;
}

interface Props {
  room: Room;
  onBack: () => void;
}

function RoomView({ room, onBack }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  useEffect(() => {
    fetch(`/api/events/${room.id}/setlist`)
      .then((res) => res.json())
      .then((data) => setSongs(data.songs));
  }, [room.id]);

  const { isIdentifying } = useRoomSocket(room.roomCode, (song) => {
    setSongs((prev) => [song, ...prev]);
  });

  function handleAddSong(e: React.FormEvent) {
    e.preventDefault();
    fetch(`/api/events/${room.id}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist }),
    });
    setTitle('');
    setArtist('');
  }

  return (
    <div className='min-h-screen bg-gray-950 flex flex-col items-center px-4 py-10'>
      <div className='w-full max-w-lg'>
        {/* Header */}
        <div className='flex items-center gap-4 mb-8'>
          <button
            onClick={onBack}
            className='text-gray-400 hover:text-white transition-colors text-sm cursor-pointer'
          >
            ← Back
          </button>
          <div>
            <h1 className='text-2xl font-bold text-white'>{room.name}</h1>
            <span className='text-xs font-mono text-accent'>
              {room.roomCode}
            </span>
          </div>
        </div>

        {/* Identify button */}
        <IdentifyButton eventId={room.id} roomLocked={isIdentifying} />

        {/* Manual add song form */}
        <form onSubmit={handleAddSong} className='flex flex-col gap-2 mt-4 sm:flex-row sm:gap-3'>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Song title'
            className='w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors text-base sm:text-sm'
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder='Artist'
            className='w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors text-base sm:text-sm'
          />
          <button
            type='submit'
            disabled={!title || !artist}
            className='w-full sm:w-auto bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm cursor-pointer'
          >
            Add
          </button>
        </form>

        {/* Setlist */}
        <div className='mt-8'>
          <h2 className='text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4'>
            Setlist
          </h2>
          {songs.length === 0 ? (
            <p className='text-gray-600 text-sm text-center py-12'>
              No songs identified yet
            </p>
          ) : (
            <ul className='flex flex-col gap-3'>
              {songs.map((song) => (
                <li
                  key={song.id}
                  className='flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3'
                >
                  {song.albumArt ? (
                    <img
                      src={song.albumArt}
                      alt={song.title}
                      className='w-12 h-12 rounded-lg object-cover shrink-0'
                    />
                  ) : (
                    <div className='w-12 h-12 rounded-lg bg-gray-800 shrink-0' />
                  )}
                  <div className='flex-1 min-w-0'>
                    <p className='text-white font-medium truncate'>
                      {song.title}
                    </p>
                    <p className='text-gray-400 text-sm truncate'>
                      {song.artist}
                    </p>
                  </div>
                  {song.spotifyId && (
                    <a
                      href={`https://open.spotify.com/track/${song.spotifyId}`}
                      target='_blank'
                      rel='noreferrer'
                      className='text-accent hover:text-accent-hover text-xs font-medium shrink-0 transition-colors'
                    >
                      <p className='text-center'>Open in</p>
                      <p className='text-center'>Spotify ↗</p>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoomView;
