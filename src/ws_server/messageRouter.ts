import { WebSocket } from 'ws';
import { GameDataStore } from '../data/storage';
import { PlayerManager } from '../game/playerManager';
import { RoomManager } from '../game/roomManager';
import { GameSession } from '../game/gameSession';
import { GameManager } from '../game/gameManager';
import { BattleLogic } from '../game/battleLogic';
import { GameLogger } from '../utils/logger';

export class MessageRouter {
  private playerManager: PlayerManager;
  private roomManager: RoomManager;
  private gameSession: GameSession;
  private gameManager: GameManager;
  private battleLogic: BattleLogic;

  constructor(private dataStore: GameDataStore) {
    this.playerManager = new PlayerManager(dataStore);
    this.roomManager = new RoomManager(dataStore);
    this.gameSession = new GameSession(dataStore);
    this.gameManager = new GameManager(dataStore);
    this.battleLogic = new BattleLogic();
  }

  async handleIncomingMessage(connectionId: string, message: string, socket: WebSocket) {
    try {
      const parsedMessage = JSON.parse(message);

      let messageData: any = {};
      if (parsedMessage.data) {
        if (typeof parsedMessage.data === 'string') {
          messageData = JSON.parse(parsedMessage.data);
        } else {
          messageData = parsedMessage.data;
        }
      }

      GameLogger.log(`Received message type: ${parsedMessage.type}`);

      switch (parsedMessage.type) {
        case 'reg':
          await this.handleRegistration(connectionId, messageData, socket);
          break;
        case 'create_room':
          this.handleLobbyCreation(connectionId);
          break;
        case 'add_user_to_room':
          this.handleLobbyJoin(connectionId, messageData);
          break;
        case 'add_ships':
          this.handleVesselPlacement(connectionId, messageData);
          break;
        case 'attack':
          this.handleAttack(connectionId, messageData);
          break;
        case 'randomAttack':
          this.handleRandomAttack(connectionId, messageData);
          break;
        default:
          GameLogger.warn(`Unknown message type: ${parsedMessage.type}`);
      }
    } catch (error) {
      GameLogger.error('Message processing failed', error);
    }
  }

  private async handleRegistration(connectionId: string, data: any, socket: WebSocket) {
    const result = this.playerManager.authenticatePlayer(
      data.name,
      data.password,
      connectionId,
      socket
    );

    const response = {
      type: 'reg',
      data: JSON.stringify(result),
      id: 0
    };

    socket.send(JSON.stringify(response));

    if (!result.error) {
      this.broadcastGameState();
    }
  }

  private handleLobbyCreation(connectionId: string) {
    GameLogger.log(`MessageRouter.handleLobbyCreation called for connection: ${connectionId}`);

    const user = this.dataStore.getUserByConnection(connectionId);
    if (!user) {
      GameLogger.log(`ERROR: User not found for connection: ${connectionId}`);
      return;
    }

    GameLogger.log(`User found: ${user.username}, creating lobby...`);

    const lobbyId = this.roomManager.createNewLobby(connectionId);

    if (lobbyId) {
      GameLogger.log(`Lobby created successfully with ID: ${lobbyId}`);
      this.broadcastGameState();
    } else {
      GameLogger.log(`FAILED to create lobby for user: ${user.username}`);
    }
  }

  private handleLobbyJoin(connectionId: string, data: any) {
    GameLogger.log(`MessageRouter.handleLobbyJoin: connection=${connectionId}, data=${JSON.stringify(data)}`);

    const joined = this.roomManager.joinLobby(data.indexRoom, connectionId);
    if (joined) {
      GameLogger.log(`User successfully joined lobby, starting game...`);
      const gameId = this.roomManager.startGameFromLobby(data.indexRoom);
      if (gameId) {
        GameLogger.log(`Game created with ID: ${gameId}, notifying players...`);
        this.notifyGameStart(gameId);
        this.broadcastGameState();
      }
    } else {
      GameLogger.log(`Failed to join lobby`);
    }
  }

  private handleVesselPlacement(connectionId: string, data: any) {
    GameLogger.log(`MessageRouter.handleVesselPlacement: gameId=${data.gameId}, playerId=${data.indexPlayer}, ships=${data.ships.length}`);

    const success = this.gameSession.setupPlayerVessels(
      data.gameId,
      data.indexPlayer,
      data.ships
    );

    if (success) {
      GameLogger.log(`SUCCESS: Both players ships placed, broadcasting start game for ${data.gameId}`);
      this.broadcastStartGame(data.gameId);
    } else {
      GameLogger.log(`First player ships placed, waiting for second player...`);
    }
  }

  private handleAttack(connectionId: string, data: any) {
    GameLogger.log(`Attack received: game=${data.gameId}, player=${data.indexPlayer}, target=(${data.x},${data.y})`);

    if (!this.gameManager.canPlayerAttack(data.gameId, data.indexPlayer)) {
      GameLogger.log(`Attack rejected: not player's turn. Player: ${data.indexPlayer}`);
      return;
    }

    const result = this.gameManager.processAttack(
      data.gameId,
      data.indexPlayer,
      data.x,
      data.y
    );

    if (result) {
      this.processAttackResult(data.gameId, connectionId, data, result);
    } else {
      GameLogger.log(`Attack was invalid`);
    }
  }

  private handleRandomAttack(connectionId: string, data: any) {
    GameLogger.log(`Random attack received: game=${data.gameId}, player=${data.indexPlayer}`);

    if (!this.gameManager.canPlayerAttack(data.gameId, data.indexPlayer)) {
      GameLogger.log(`Random attack rejected: not player's turn. Player: ${data.indexPlayer}`);
      return;
    }

    const opponent = this.dataStore.getOpponent(data.gameId, data.indexPlayer);
    if (!opponent?.gameData) {
      GameLogger.log(`Random attack failed: opponent not found`);
      return;
    }

    const randomTarget = this.battleLogic.executeRandomAttack(
      opponent.gameData.availableTargets
    );

    if (randomTarget) {
      GameLogger.log(`Random target selected: (${randomTarget.x},${randomTarget.y})`);
      this.handleAttack(connectionId, {
        ...data,
        x: randomTarget.x,
        y: randomTarget.y
      });
    } else {
      GameLogger.log(`No available targets for random attack`);
    }
  }

  private processAttackResult(gameId: string, connectionId: string, data: any, result: any) {
    GameLogger.log(`Attack result: ${result.status} at (${data.x},${data.y})`);

    this.broadcastAttackResult(gameId, {
      position: { x: data.x, y: data.y },
      currentPlayer: data.indexPlayer,
      status: result.status
    });

    if (result.status === 'killed' && result.borderCells) {
      GameLogger.log(`Ship killed, sending misses for ${result.borderCells.length} border cells`);

      result.borderCells.forEach((border: { x: number; y: number }) => {
        this.broadcastAttackResult(gameId, {
          position: { x: border.x, y: border.y },
          currentPlayer: data.indexPlayer,
          status: 'miss'
        });
      });

      this.gameSession.handleVesselSunk(gameId, result.vessel);
    }

    if (result.status === 'miss') {
      this.gameSession.switchTurn(gameId, data.indexPlayer);
    }

    const winnerId = this.gameManager.checkGameCompletion(gameId);
    if (winnerId) {
      GameLogger.log(`Game completed! Winner: ${winnerId}`);
      this.handleGameCompletion(gameId, winnerId);
    } else {
      this.broadcastTurn(gameId);
    }
  }

  private broadcastAttackResult(gameId: string, attackData: any) {
    this.broadcastToGame(gameId, {
      type: 'attack',
      data: JSON.stringify(attackData),
      id: 0
    });
  }

  private broadcastGameState() {
    GameLogger.log(`MessageRouter.broadcastGameState called`);

    const lobbies = this.roomManager.getAllActiveLobbies();
    const leaderboard = this.playerManager.getLeaderboardData();

    GameLogger.log(`Broadcasting ${lobbies.length} lobbies and ${leaderboard.length} leaderboard entries`);

    const roomMessage = {
      type: 'update_room',
      data: JSON.stringify(lobbies),
      id: 0
    };

    const winnerMessage = {
      type: 'update_winners',
      data: JSON.stringify(leaderboard),
      id: 0
    };

    this.broadcastToAll(roomMessage);
    this.broadcastToAll(winnerMessage);
  }

  private notifyGameStart(gameId: string) {
    const game = this.dataStore.getGame(gameId);
    if (!game) {
      GameLogger.log(`ERROR: Game not found for ID: ${gameId}`);
      return;
    }

    GameLogger.log(`Notifying game start for game: ${gameId} with ${Object.keys(game.participants).length} players`);

    Object.values(game.participants).forEach(player => {
      const user = this.dataStore.getUserByConnection(player.connectionId);
      if (user) {
        const response = {
          type: 'create_game',
          data: JSON.stringify({
            idGame: gameId,
            idPlayer: player.connectionId
          }),
          id: 0
        };
        GameLogger.log(`Sending create_game to: ${player.username}`);
        user.socket.send(JSON.stringify(response));
      } else {
        GameLogger.log(`ERROR: User not found for connection: ${player.connectionId}`);
      }
    });
  }

  private broadcastStartGame(gameId: string) {
    const game = this.dataStore.getGame(gameId);
    if (!game) {
      GameLogger.log(`ERROR: Game not found for broadcastStartGame: ${gameId}`);
      return;
    }

    GameLogger.log(`Broadcasting start game for: ${gameId}`);

    Object.values(game.participants).forEach(player => {
      const user = this.dataStore.getUserByConnection(player.connectionId);
      if (user && player.gameData) {
        const response = {
          type: 'start_game',
          data: JSON.stringify({
            ships: player.gameData.vessels,
            currentPlayerIndex: player.connectionId
          }),
          id: 0
        };
        GameLogger.log(`Sending start_game to: ${player.username} with ${player.gameData.vessels.length} ships`);
        user.socket.send(JSON.stringify(response));
      }
    });

    this.broadcastTurn(gameId);
  }

  private broadcastTurn(gameId: string) {
    const game = this.dataStore.getGame(gameId);
    if (!game?.currentTurn) {
      GameLogger.log(`ERROR: No current turn for game: ${gameId}`);
      return;
    }

    const currentPlayer = game.currentTurn;
    GameLogger.log(`Broadcasting turn: ${currentPlayer}`);

    this.broadcastToGame(gameId, {
      type: 'turn',
      data: JSON.stringify({ currentPlayer }),
      id: 0
    });
  }

  private handleGameCompletion(gameId: string, winnerId: string) {
    const winner = this.dataStore.getUserByConnection(winnerId);
    if (winner) {
      this.playerManager.updatePlayerStats(winner.username);

      GameLogger.log(`Game completed! Winner: ${winner.username}`);

      this.broadcastToGame(gameId, {
        type: 'finish',
        data: JSON.stringify({ winPlayer: winnerId }),
        id: 0
      });

      this.broadcastGameState();
    }
  }

  private broadcastToGame(gameId: string, message: any) {
    const game = this.dataStore.getGame(gameId);
    if (!game) {
      GameLogger.log(`ERROR: Game not found for broadcast: ${gameId}`);
      return;
    }

    Object.values(game.participants).forEach(player => {
      const user = this.dataStore.getUserByConnection(player.connectionId);
      if (user) {
        user.socket.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToAll(message: any) {
    const users = this.playerManager.getAllConnectedUsers();
    GameLogger.log(`Broadcasting to ${users.length} users: ${message.type}`);

    users.forEach(user => {
      if (user.socket.readyState === WebSocket.OPEN) {
        user.socket.send(JSON.stringify(message));
      }
    });
  }
}