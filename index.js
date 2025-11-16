import { httpServer } from "./src/http_server/index.js";
import { WebSocketServer } from 'ws';
import { WSServer } from './src/ws_server/index.js';

const HTTP_PORT = 8181;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

const wss = new WebSocketServer({ port: 3000 });
new WSServer(wss);

console.log(`WebSocket server started on port 3000`);