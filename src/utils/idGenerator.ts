import { generateUniqueId } from './helpers';

export class IdGenerator {
  static generateGameId(): string {
    return `game-${generateUniqueId()}`;
  }

  static generateLobbyId(): string {
    return `lobby-${generateUniqueId()}`;
  }
}