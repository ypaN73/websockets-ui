import { WebSocketServer, WebSocket } from 'ws';
import { GameDataStore } from '../data/storage';
import { ConnectionManager } from './connectionManager';
import { MessageRouter } from './messageRouter';
import { SERVER_PORT } from '../data/constants';
import { GameLogger } from '../utils/logger';
import { generateUniqueId } from '../utils/helpers';

export class WebSocketGameServer {
  private dataStore: GameDataStore;
  private connectionManager: ConnectionManager;
  private messageRouter: MessageRouter;

  constructor() {
    this.dataStore = new GameDataStore();
    this.connectionManager = new ConnectionManager(this.dataStore);
    this.messageRouter = new MessageRouter(this.dataStore);
  }

  initialize() {
    const webSocketServer = new WebSocketServer({
      port: SERVER_PORT
    });

    webSocketServer.on('connection', (socket: WebSocket) => {
      const connectionId = generateUniqueId();

      this.connectionManager.registerConnection(connectionId, socket);
      GameLogger.log(`Client connected: ${connectionId}`);

      socket.on('message', (message: Buffer) => {
        try {
          this.messageRouter.handleIncomingMessage(
            connectionId,
            message.toString(),
            socket
          );
        } catch (error) {
          GameLogger.error('Error processing message', error);
        }
      });

      socket.on('close', () => {
        this.connectionManager.removeConnection(connectionId);
        GameLogger.log(`Client disconnected: ${connectionId}`);
      });

      socket.on('error', (error: Error) => {
        GameLogger.error(`Connection error: ${connectionId}`, error);
      });
    });

    GameLogger.log(`WebSocket game server started on port ${SERVER_PORT}`);
    console.log(` WebSocket Server running on ws://localhost:${SERVER_PORT}`);
    return webSocketServer;
  }
}