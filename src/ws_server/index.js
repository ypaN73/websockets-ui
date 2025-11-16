import { WebSocketServer } from 'ws';

export class WSServer {
  constructor(wss) {
    console.log('WebSocket server initialized');

    wss.on('connection', (ws) => {
      console.log('New WebSocket connection established');

      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });

      this.send(ws, { type: 'connected', data: 'Welcome to Battleship!', id: 0 });
    });
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);

      // Базовая обработка - просто эхо
      this.send(ws, {
        type: 'echo',
        data: `Received: ${message.type}`,
        id: message.id
      });

    } catch (error) {
      console.error('Error parsing message:', error);
      this.sendError(ws, 'Invalid JSON format');
    }
  }

  send(ws, message) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, errorText) {
    this.send(ws, {
      type: 'error',
      data: { error: true, errorText },
      id: 0
    });
  }
}