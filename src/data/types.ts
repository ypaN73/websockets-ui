import { WebSocket } from 'ws';

export interface GameUser {
  username: string;
  password: string;
  connectionId: string;
  socket: WebSocket;
  victories: number;
}

export interface GameLobby {
  roomId: string;
  roomUsers: Array<{
    name: string;
    index: string;
  }>;
}

export interface Vessel {
  position: { x: number; y: number };
  direction: boolean;
  length: number;
  type: "small" | "medium" | "large" | "huge";
}

export interface VesselCell extends Vessel {
  health: number;
  borders: Array<{ y: number; x: number }>;
  vesselCells: Array<{ y: number; x: number }>;
}

export interface GameCell {
  y: number;
  x: number;
  state: CellState;
  vessel?: VesselCell;
}

export type GameBoard = Array<Array<GameCell>>;
export type CoordinateKey = string;
export type AvailableCells = Map<CoordinateKey, { x: number; y: number }>;

export interface PlayerGameData {
  vessels: Vessel[];
  board: GameBoard;
  remainingVessels: number;
  availableTargets: AvailableCells;
}

export interface ActivePlayer {
  username: string;
  connectionId: string;
  opponent: string;
  gameData?: PlayerGameData;
}

export interface ActiveGame {
  gameId: string;
  participants: Record<string, ActivePlayer>;
  isActive: boolean;
  currentTurn?: string;
}

export interface GameResult {
  name: string;
  wins: number;
}

export enum CellState {
  UNTOUCHED = "untouched",
  HIT = "hit",
  SUNK = "sunk",
  MISS = "miss"
}

export type MessageType = "update_room" | "update_winners";