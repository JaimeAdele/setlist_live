import { useEffect, useState } from 'react';
import socket from '../lib/socket';

interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string | null;
  spotifyId: string | null;
  identifiedAt: string;
}

export function useRoomSocket(
  roomCode: string,
  onSongAdded: (song: Song) => void,
  onSongRemoved: (songId: string) => void
) {
  const [isIdentifying, setIsIdentifying] = useState(false);

  useEffect(() => {
    socket.emit('join:room', roomCode);

    socket.on('song:added', onSongAdded);
    socket.on('song:removed', ({ songId }: { songId: string }) => {
      onSongRemoved(songId);
    });
    let lockTimeout: ReturnType<typeof setTimeout>;
    socket.on('identify:start', () => {
      setIsIdentifying(true);
      lockTimeout = setTimeout(() => setIsIdentifying(false), 20000);
    });
    socket.on('identify:end', () => {
      clearTimeout(lockTimeout);
      setIsIdentifying(false);
    });

    return () => {
      socket.off('song:added', onSongAdded);
      socket.off('song:removed', onSongRemoved);
      socket.off('identify:start');
      socket.off('identify:end');
    };
  }, [roomCode]);

  return { isIdentifying };
}
