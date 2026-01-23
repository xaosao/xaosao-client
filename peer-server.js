// PeerJS Server for WebRTC signaling
// Run with: node peer-server.js

const { PeerServer } = require('peer');

const PORT = 9000;

const peerServer = PeerServer({
  port: PORT,
  path: '/peerjs',
  // Allow all origins for development
  proxied: true,
  // Debug level (0 = no logs, 1 = errors, 2 = warnings, 3 = all)
  debug: true,
  // Allow all types of messages
  allow_discovery: true,
});

peerServer.on('connection', (client) => {
  console.log(`[PeerServer] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`[PeerServer] Client disconnected: ${client.getId()}`);
});

peerServer.on('error', (error) => {
  console.error('[PeerServer] Error:', error);
});

console.log(`[PeerServer] Running on port ${PORT}`);
console.log(`[PeerServer] Access via: ws://localhost:${PORT}/peerjs`);
console.log(`[PeerServer] For ngrok, use: wss://<ngrok-url>/peerjs (after proxying port ${PORT})`);
