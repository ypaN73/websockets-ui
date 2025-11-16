import { GameUser, GameLobby, ActiveGame, GameResult, ActivePlayer, Vessel, GameBoard, AvailableCells } from './types.js';
import { WebSocket } from 'ws';
import { GameLogger } from '../utils/logger.js';

export class GameDataStore {
  private userRegistry: Map<string, GameUser> = new Map();
  private lobbyRegistry: Map<string, GameLobby> = new Map();
  private activeGames: Map<string, ActiveGame> = new Map();
  private leaderboard: Map<string, GameResult> = new Map();
  private userLobbyMap: Map<string, string> = new Map();

  registerUser(username: string, userData: GameUser) {
    this.userRegistry.set(username, userData);
    GameLogger.log(`User registered: ${username}`);
  }

  getUserByName(username: string): GameUser | undefined {
    return this.userRegistry.get(username);
  }

  getUserByConnection(connectionId: string): GameUser | undefined {
    for (const user of this.userRegistry.values()) {
      if (user.connectionId === connectionId) {
        return user;
      }
    }
    return undefined;
  }

  updateUserConnection(username: string, connectionId: string, socket: WebSocket) {
    const user = this.userRegistry.get(username);
    if (user) {
      const oldConnectionId = user.connectionId;
      if (this.userLobbyMap.has(oldConnectionId)) {
        const lobbyId = this.userLobbyMap.get(oldConnectionId);
        this.userLobbyMap.delete(oldConnectionId);
        this.userLobbyMap.set(connectionId, lobbyId!);
      }

      user.connectionId = connectionId;
      user.socket = socket;
      GameLogger.log(`User connection updated: ${username}`);
    }
  }

  getAllUsers(): GameUser[] {
    return Array.from(this.userRegistry.values());
  }

  createLobby(lobbyId: string, creator: { username: string; connectionId: string }) {
    GameLogger.log(`GameDataStore.createLobby: creating lobby ${lobbyId} for user ${creator.username}`);

    const lobby: GameLobby = {
      roomId: lobbyId,
      roomUsers: [{
        name: creator.username,
        index: creator.connectionId
      }]
    };

    this.lobbyRegistry.set(lobbyId, lobby);
    this.userLobbyMap.set(creator.connectionId, lobbyId);

    GameLogger.log(`Lobby created: ${lobbyId} by ${creator.username}`);
    GameLogger.log(`Total lobbies count: ${this.lobbyRegistry.size}`);

    return lobby;
  }

  getLobby(lobbyId: string): GameLobby | undefined {
    return this.lobbyRegistry.get(lobbyId);
  }

  removeLobby(lobbyId: string) {
    const lobby = this.lobbyRegistry.get(lobbyId);
    if (lobby) {
      lobby.roomUsers.forEach(participant => {
        this.userLobbyMap.delete(participant.index);
      });
      this.lobbyRegistry.delete(lobbyId);
      GameLogger.log(`Lobby removed: ${lobbyId}`);
    }
  }

  getLobbyByUser(connectionId: string): string | undefined {
    const lobbyId = this.userLobbyMap.get(connectionId);
    GameLogger.log(`getLobbyByUser: ${connectionId} -> ${lobbyId}`);
    return lobbyId;
  }

  getAllLobbies(): GameLobby[] {
    const lobbies = Array.from(this.lobbyRegistry.values());
    GameLogger.log(`getAllLobbies: returning ${lobbies.length} lobbies`);
    return lobbies;
  }

  startGame(gameId: string, players: Array<{ username: string; connectionId: string }>) {
    const participants: Record<string, ActivePlayer> = {};

    participants[players[0].connectionId] = {
      username: players[0].username,
      connectionId: players[0].connectionId,
      opponent: players[1].connectionId
    };

    participants[players[1].connectionId] = {
      username: players[1].username,
      connectionId: players[1].connectionId,
      opponent: players[0].connectionId
    };

    const game: ActiveGame = {
      gameId,
      participants,
      isActive: false,
      currentTurn: players[0].connectionId
    };

    this.activeGames.set(gameId, game);

    // Удаляем связи с лобби
    players.forEach(player => {
      this.userLobbyMap.delete(player.connectionId);
    });

    GameLogger.log(`Game started: ${gameId} with players: ${players[0].username}, ${players[1].username}`);
    return game;
  }

  getGame(gameId: string): ActiveGame | undefined {
    return this.activeGames.get(gameId);
  }

  setPlayerVessels(gameId: string, playerId: string, vessels: Vessel[], board: GameBoard, availableTargets: AvailableCells) {
    const game = this.activeGames.get(gameId);
    if (game && game.participants[playerId]) {
      game.participants[playerId].gameData = {
        vessels,
        board,
        remainingVessels: vessels.length,
        availableTargets
      };
      GameLogger.log(`Vessels set for player ${playerId} in game ${gameId}. Ships count: ${vessels.length}`);

      // Проверяем, готовы ли оба игрока к началу игры
      const readyPlayers = Object.values(game.participants).filter(p => p.gameData).length;
      GameLogger.log(`Ready players in game ${gameId}: ${readyPlayers}/2`);

      if (readyPlayers === 2) {
        game.isActive = true;
        GameLogger.log(`Game ${gameId} is now ACTIVE - both players have placed ships`);
      }
    } else {
      GameLogger.log(`ERROR: Cannot set vessels - game or player not found`);
    }
  }

  getOpponent(gameId: string, playerId: string): ActivePlayer | undefined {
    const game = this.activeGames.get(gameId);
    return game ? game.participants[game.participants[playerId].opponent] : undefined;
  }

  updateLeaderboard(username: string) {
    const current = this.leaderboard.get(username);
    if (current) {
      current.wins++;
    } else {
      this.leaderboard.set(username, { name: username, wins: 1 });
    }
    GameLogger.log(`Leaderboard updated for: ${username}`);
  }

  getLeaderboard(): GameResult[] {
    return Array.from(this.leaderboard.values());
  }
}