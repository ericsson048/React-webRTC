import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});
