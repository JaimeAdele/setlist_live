import { io } from 'socket.io-client';

// Connect to whatever origin served this page.
// - Locally: connects to localhost:5173, Vite proxies /socket.io → localhost:3000
// - Via ngrok: connects to the ngrok URL, which flows through the same Vite proxy chain
const socket = io();

export default socket;