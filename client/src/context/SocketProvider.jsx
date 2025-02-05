import React, { createContext, useMemo, useContext } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);
const SOCKET_URL = process.env.REACT_APP_SERVER_URL||"https://react-webrtc-server-68bx.onrender.com" || "http://localhost:8000";


export const useSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};

export const SocketProvider = (props) => {
  const socket = useMemo(() => io(SOCKET_URL, {
    transports: ["websocket"],
  }), []);

  return (
    <SocketContext.Provider value={socket}>
      {props.children}
    </SocketContext.Provider>
  );
};
