export class GameLogger {
  static log(message: string, data?: any) {
    console.log(`[Game Server] ${message}`, data ? data : '');
  }

  static error(message: string, error?: any) {
    console.error(`[Game Server Error] ${message}`, error ? error : '');
  }

  static warn(message: string) {
    console.warn(`[Game Server Warning] ${message}`);
  }
}