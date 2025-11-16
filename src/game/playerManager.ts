import { GameDataStore } from '../data/storage.js';
import { ErrorMessages } from '../data/constants.js';
import { GameLogger } from '../utils/logger.js';
import { WebSocket } from 'ws';

export class PlayerManager {
  constructor(private dataStore: GameDataStore) { }

  authenticatePlayer(username: string, password: string, connectionId: string, socket: WebSocket) {
    const existingUser = this.dataStore.getUserByName(username);

    const result = {
      name: username,
      index: connectionId,
      error: false,
      errorText: ''
    };

    if (!existingUser) {
      this.dataStore.registerUser(username, {
        username,
        password,
        connectionId,
        socket,
        victories: 0
      });
      GameLogger.log(`New user registered: ${username}`);
    } else {
      if (existingUser.password === password) {
        this.dataStore.updateUserConnection(username, connectionId, socket);
        GameLogger.log(`User reconnected: ${username}`);
      } else {
        result.error = true;
        result.errorText = ErrorMessages.WRONG_PASSWORD;
        GameLogger.warn(`Failed authentication for: ${username}`);
      }
    }

    return result;
  }

  updatePlayerStats(winnerUsername: string) {
    this.dataStore.updateLeaderboard(winnerUsername);
    GameLogger.log(`Player stats updated: ${winnerUsername}`);
  }

  getLeaderboardData() {
    return this.dataStore.getLeaderboard();
  }

  getAllConnectedUsers() {
    return this.dataStore.getAllUsers();
  }
}