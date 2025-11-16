import { GameDataStore } from '../data/storage';
import { GameLogger } from '../utils/logger';

export class GameManager {
  constructor(private dataStore: GameDataStore) { }

  initializeGame(gameId: string) {
    const game = this.dataStore.getGame(gameId);
    if (game) {
      game.isActive = true;
      GameLogger.log(`Game initialized: ${gameId}`);
    }
  }

  processAttack(gameId: string, attackerId: string, targetX: number, targetY: number) {
    const game = this.dataStore.getGame(gameId);

    if (!game) {
      GameLogger.log(`Game not found: ${gameId}`);
      return null;
    }

    if (!game.isActive) {
      GameLogger.log(`Game is not active: ${gameId}`);
      return null;
    }

    if (game.currentTurn !== attackerId) {
      GameLogger.log(`Invalid attack: not player's turn. Current turn: ${game.currentTurn}, attacker: ${attackerId}`);
      return null;
    }

    if (!game.participants[attackerId]) {
      GameLogger.log(`Attacker not found in game: ${attackerId}`);
      return null;
    }

    const opponent = this.dataStore.getOpponent(gameId, attackerId);
    if (!opponent?.gameData) {
      GameLogger.log(`Opponent not found for attack`);
      return null;
    }

    if (targetX < 0 || targetX > 9 || targetY < 0 || targetY > 9) {
      GameLogger.log(`Invalid attack coordinates: (${targetX}, ${targetY})`);
      return null;
    }

    GameLogger.log(`Valid attack: player ${attackerId} attacking (${targetX}, ${targetY})`);
    return this.executeAttack(opponent.gameData, targetX, targetY);
  }

  private executeAttack(gameData: any, x: number, y: number) {
    const cell = gameData.board[y][x];

    if (cell.state !== 'untouched') {
      GameLogger.log(`Cell already attacked: (${x}, ${y}) - ${cell.state}`);
      return null;
    }

    if (!cell.vessel) {
      cell.state = 'miss';
      GameLogger.log(`Miss at (${x}, ${y})`);
      return { status: 'miss' };
    }

    cell.vessel.health--;
    if (cell.vessel.health > 0) {
      cell.state = 'hit';
      GameLogger.log(`Hit at (${x}, ${y}), health remaining: ${cell.vessel.health}`);
      return { status: 'shot' };
    } else {
      gameData.remainingVessels--;
      cell.state = 'sunk';
      GameLogger.log(`Ship sunk at (${x}, ${y}), remaining vessels: ${gameData.remainingVessels}`);
      return {
        status: 'killed',
        vessel: cell.vessel,
        shipCells: cell.vessel.vesselCells,
        borderCells: cell.vessel.borders
      };
    }
  }

  checkGameCompletion(gameId: string): string | null {
    const game = this.dataStore.getGame(gameId);
    if (!game) return null;

    for (const playerId in game.participants) {
      const player = game.participants[playerId];
      if (player.gameData?.remainingVessels === 0) {
        GameLogger.log(`Game completed! Winner: ${player.opponent}`);
        return player.opponent;
      }
    }
    return null;
  }

  canPlayerAttack(gameId: string, playerId: string): boolean {
    const game = this.dataStore.getGame(gameId);
    if (!game || !game.isActive) return false;

    return game.currentTurn === playerId;
  }
}