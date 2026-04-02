import { io } from 'socket.io-client';

console.log('Connecting to WebSocket...');
const socket = io('http://localhost:40001');

socket.on('connect', () => {
  console.log('Connected to server! Socket ID:', socket.id);

  // Listen for message events
  socket.on('message:new', (data) => {
    console.log('Received message:new event:', data);
  });

  socket.on('wpp:message', (data) => {
    console.log('Received wpp:message event:', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  // Send a test message to join a session (if needed)
  socket.emit('join', 'test-session');
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
});

setTimeout(() => {
  console.log('Timeout reached, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 10000);