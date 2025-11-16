import { GameDataStore } from '../data/storage';
import { IdGenerator } from '../utils/idGenerator';
import { GameLogger } from '../utils/logger';
import { MAX_LOBBY_PARTICIPANTS } from '../data/constants';

export class RoomManager {
  constructor(private dataStore: GameDataStore) { }

  createNewLobby(creatorId: string): string | null {
    GameLogger.log(`RoomManager.createNewLobby called for connection: ${creatorId}`);

    const user = this.dataStore.getUserByConnection(creatorId);
    if (!user) {
      GameLogger.log(`User not found for connection: ${creatorId}`);
      return null;
    }

    GameLogger.log(`Found user: ${user.username}`);

    const existingLobbyId = this.dataStore.getLobbyByUser(creatorId);
    if (existingLobbyId) {
      GameLogger.log(`User ${user.username} already in lobby: ${existingLobbyId}`);
      return null;
    }

    const lobbyId = IdGenerator.generateLobbyId();
    GameLogger.log(`Generated new lobby ID: ${lobbyId}`);

    const lobby = this.dataStore.createLobby(lobbyId, {
      username: user.username,
      connectionId: creatorId
    });

    GameLogger.log(`Lobby created successfully: ${lobbyId} with participants: ${lobby.roomUsers.length}`);
    return lobbyId;
  }

  joinLobby(lobbyId: string, joinerId: string): boolean {
    GameLogger.log(`RoomManager.joinLobby called: lobby=${lobbyId}, joiner=${joinerId}`);

    const lobby = this.dataStore.getLobby(lobbyId);
    const user = this.dataStore.getUserByConnection(joinerId);

    if (!lobby) {
      GameLogger.log(`Lobby not found: ${lobbyId}`);
      return false;
    }

    if (!user) {
      GameLogger.log(`User not found for connection: ${joinerId}`);
      return false;
    }

    GameLogger.log(`Lobby found with ${lobby.roomUsers.length} participants`);
    GameLogger.log(`Participants: ${lobby.roomUsers.map(p => p.name).join(', ')}`);

    if (lobby.roomUsers.length >= MAX_LOBBY_PARTICIPANTS) {
      GameLogger.log(`Lobby ${lobbyId} is full`);
      return false;
    }

    if (lobby.roomUsers[0].index === joinerId) {
      GameLogger.log(`User ${user.username} trying to join own lobby`);
      return false;
    }

    lobby.roomUsers.push({
      name: user.username,
      index: joinerId
    });

    GameLogger.log(`User ${user.username} joined lobby: ${lobbyId}. Now ${lobby.roomUsers.length} participants`);
    return true;
  }

  startGameFromLobby(lobbyId: string): string | null {
    GameLogger.log(`RoomManager.startGameFromLobby called for lobby: ${lobbyId}`);

    const lobby = this.dataStore.getLobby(lobbyId);
    if (!lobby) {
      GameLogger.log(`Lobby not found for starting game: ${lobbyId}`);
      return null;
    }

    GameLogger.log(`Lobby participants count: ${lobby.roomUsers.length}, required: ${MAX_LOBBY_PARTICIPANTS}`);

    if (lobby.roomUsers.length !== MAX_LOBBY_PARTICIPANTS) {
      GameLogger.log(`Lobby ${lobbyId} has ${lobby.roomUsers.length} participants, need ${MAX_LOBBY_PARTICIPANTS}`);
      return null;
    }

    const gameId = IdGenerator.generateGameId();
    GameLogger.log(`Generated game ID: ${gameId}`);

    // Преобразуем roomUsers в формат для startGame
    const players = lobby.roomUsers.map(roomUser => ({
      username: roomUser.name,
      connectionId: roomUser.index
    }));

    this.dataStore.startGame(gameId, players);
    this.dataStore.removeLobby(lobbyId);

    GameLogger.log(`Game started from lobby: ${lobbyId} -> ${gameId}`);
    return gameId;
  }

  getAllActiveLobbies() {
    const lobbies = this.dataStore.getAllLobbies();
    GameLogger.log(`RoomManager.getAllActiveLobbies: returning ${lobbies.length} lobbies`);
    lobbies.forEach(lobby => {
      GameLogger.log(`Lobby ${lobby.roomId}: ${lobby.roomUsers.length} players - ${lobby.roomUsers.map(p => p.name).join(', ')}`);
    });
    return lobbies;
  }
}