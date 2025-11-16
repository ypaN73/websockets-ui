import { Vessel, GameBoard, AvailableCells, GameCell, CellState, PlayerGameData } from '../data/types';
import { BOARD_DIMENSION, TOTAL_VESSELS, ErrorMessages } from '../data/constants';
import { isValidCoordinate, createCoordinateKey } from '../utils/helpers';
import { validateVesselPlacement } from '../utils/validators';
import { GameLogger } from '../utils/logger';

export class BattleLogic {
  initializeGameBoard(): { board: GameBoard; availableCells: AvailableCells } {
    const board: GameBoard = [];
    const availableCells: AvailableCells = new Map();

    for (let row = 0; row < BOARD_DIMENSION; row++) {
      const rowCells: GameCell[] = [];
      for (let col = 0; col < BOARD_DIMENSION; col++) {
        rowCells.push({ y: row, x: col, state: CellState.UNTOUCHED });
        availableCells.set(createCoordinateKey(col, row), { x: col, y: row });
      }
      board.push(rowCells);
    }
    return { board, availableCells };
  }

  placeVesselsOnBoard(vessels: Vessel[], board: GameBoard): boolean {
    try {
      for (const vessel of vessels) {
        if (!validateVesselPlacement(vessel)) {
          throw new Error(ErrorMessages.INVALID_VESSEL);
        }
        this.positionVessel(vessel, board);
      }
      return true;
    } catch (error) {
      GameLogger.error('Vessel placement failed', error);
      return false;
    }
  }

  private positionVessel(vessel: Vessel, board: GameBoard) {
    const { position, direction, length, type } = vessel;
    const endY = direction ? position.y + length : position.y + 1;
    const endX = direction ? position.x + 1 : position.x + length;

    const borders: Array<{ y: number; x: number }> = [];
    const vesselCells: Array<{ y: number; x: number }> = [];
    const vesselData = { ...vessel, health: length, borders, vesselCells };

    for (let row = position.y - 1; row <= endY; row++) {
      for (let col = position.x - 1; col <= endX; col++) {
        if (!isValidCoordinate(col, row)) continue;

        if (row < 0 || row >= BOARD_DIMENSION || col < 0 || col >= BOARD_DIMENSION) {
          continue;
        }

        const isVesselCell = row >= position.y && row < endY &&
          col >= position.x && col < endX;

        if (isVesselCell) {
          if (board[row][col].vessel) {
            throw new Error(ErrorMessages.INVALID_VESSEL);
          }
          vesselCells.push({ y: row, x: col });
          board[row][col].vessel = vesselData;
        } else {
          borders.push({ y: row, x: col });
        }
      }
    }
  }

  executeRandomAttack(availableTargets: AvailableCells): { x: number; y: number } | null {
    if (availableTargets.size === 0) return null;

    const targetsArray = Array.from(availableTargets.values());
    const randomIndex = Math.floor(Math.random() * targetsArray.length);
    return targetsArray[randomIndex];
  }

  removeTarget(availableTargets: AvailableCells, x: number, y: number) {
    const key = createCoordinateKey(x, y);
    availableTargets.delete(key);
  }

  executeAttack(gameData: PlayerGameData, x: number, y: number): any {
    if (y < 0 || y >= BOARD_DIMENSION || x < 0 || x >= BOARD_DIMENSION) {
      return null;
    }

    const cell = gameData.board[y][x];

    if (cell.state !== CellState.UNTOUCHED) {
      return null;
    }

    if (!cell.vessel) {
      cell.state = CellState.MISS;
      this.removeTarget(gameData.availableTargets, x, y);
      return { status: 'miss' };
    }

    cell.vessel.health--;
    this.removeTarget(gameData.availableTargets, x, y);

    if (cell.vessel.health > 0) {
      cell.state = CellState.HIT;
      return { status: 'shot' };
    } else {
      gameData.remainingVessels--;
      cell.state = CellState.SUNK;

      cell.vessel.vesselCells.forEach(({ x: shipX, y: shipY }) => {
        gameData.board[shipY][shipX].state = CellState.SUNK;
      });

      return {
        status: 'killed',
        vessel: cell.vessel,
        shipCells: cell.vessel.vesselCells,
        borderCells: cell.vessel.borders
      };
    }
  }

  processKilledShip(gameData: PlayerGameData, vessel: any) {
    vessel.borders.forEach(({ x, y }: { x: number; y: number }) => {
      if (isValidCoordinate(x, y)) {
        this.removeTarget(gameData.availableTargets, x, y);
        if (gameData.board[y][x].state === CellState.UNTOUCHED) {
          gameData.board[y][x].state = CellState.MISS;
        }
      }
    });
  }
}