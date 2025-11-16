import { httpServer } from "./src/http_server/index.js";
import { WebSocketGameServer } from "./src/ws_server/index";

const HTTP_PORT = 8181;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

const gameServer = new WebSocketGameServer();
gameServer.initialize();
console.log('WebSocket game server initialized on port 3000');