import { GameDataStore } from '../data/storage';
import { BattleLogic } from './battleLogic';
import { GameLogger } from '../utils/logger';
import { Vessel } from '../data/types';

export class GameSession {
  private battleLogic: BattleLogic;

  constructor(private dataStore: GameDataStore) {
    this.battleLogic = new BattleLogic();
  }

  setupPlayerVessels(gameId: string, playerId: string, vessels: Vessel[]): boolean {
    const game = this.dataStore.getGame(gameId);
    if (!game || !game.participants[playerId]) {
      GameLogger.log(`ERROR: Game or player not found for vessel placement`);
      return false;
    }

    GameLogger.log(`Setting up vessels for player ${playerId} in game ${gameId}`);

    const { board, availableCells } = this.battleLogic.initializeGameBoard();
    const placementSuccess = this.battleLogic.placeVesselsOnBoard(vessels, board);

    if (placementSuccess) {
      GameLogger.log(`Vessels placed successfully for player ${playerId}`);
      this.dataStore.setPlayerVessels(gameId, playerId, vessels, board, availableCells);

      const readyPlayers = Object.values(game.participants).filter(p => p.gameData).length;
      GameLogger.log(`Players with ships: ${readyPlayers}/2`);

      if (readyPlayers === 2) {
        GameLogger.log(`Both players ready! Game ${gameId} can start`);
        return true;
      }
    } else {
      GameLogger.log(`Failed to place vessels for player ${playerId}`);
    }

    return false;
  }

  processPlayerAttack(gameId: string, attackerId: string, targetX: number, targetY: number): any {
    const opponent = this.dataStore.getOpponent(gameId, attackerId);
    if (!opponent?.gameData) {
      GameLogger.log(`ERROR: Opponent not found for attack`);
      return null;
    }

    const attackResult = this.battleLogic.executeAttack(opponent.gameData, targetX, targetY);
    return attackResult;
  }

  handleVesselSunk(gameId: string, vessel: any) {
    const game = this.dataStore.getGame(gameId);
    if (!game) return;

    GameLogger.log(`Handling sunk vessel with ${vessel.borders.length} border cells`);

    Object.values(game.participants).forEach(player => {
      if (player.gameData) {
        this.battleLogic.processKilledShip(player.gameData, vessel);
      }
    });
  }

  switchTurn(gameId: string, currentPlayerId: string) {
    const game = this.dataStore.getGame(gameId);
    if (game) {
      const newTurnPlayer = game.participants[currentPlayerId].opponent;
      game.currentTurn = newTurnPlayer;
      GameLogger.log(`Turn switched from ${currentPlayerId} to ${newTurnPlayer}`);
    }
  }
}