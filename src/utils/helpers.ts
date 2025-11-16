import { LAST_BOARD_INDEX } from '../data/constants.js';

export const isValidCoordinate = (x: number, y: number): boolean => (
  y >= 0 && x >= 0 && y <= LAST_BOARD_INDEX && x <= LAST_BOARD_INDEX
);

export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createCoordinateKey = (x: number, y: number): string => `${x}.${y}`;