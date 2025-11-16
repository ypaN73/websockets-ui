import { WebSocket } from 'ws';
import { GameDataStore } from '../data/storage';
import { GameLogger } from '../utils/logger';

export class ConnectionManager {
  private activeConnections: Map<string, WebSocket> = new Map();

  constructor(private dataStore: GameDataStore) { }

  registerConnection(connectionId: string, socket: WebSocket) {
    this.activeConnections.set(connectionId, socket);
    GameLogger.log(`New connection: ${connectionId}`);
  }
  getAllActiveConnections(): Map<string, WebSocket> {
    return this.activeConnections;
  }

  removeConnection(connectionId: string) {
    this.activeConnections.delete(connectionId);

    const lobbyId = this.dataStore.getLobbyByUser(connectionId);
    if (lobbyId) {
      this.dataStore.removeLobby(lobbyId);
    }

    GameLogger.log(`Connection closed: ${connectionId}`);
  }

  sendToConnection(connectionId: string, message: string) {
    const socket = this.activeConnections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }

  broadcastToAll(message: string) {
    this.activeConnections.forEach((socket, connectionId) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    });
  }

  getConnection(connectionId: string): WebSocket | undefined {
    return this.activeConnections.get(connectionId);
  }
}