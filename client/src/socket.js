import { io } from "socket.io-client";

// If opened via ngrok/external URL, connect to same host but port 5000
// If opened via localhost, connect to localhost:5000
const getServerURL = () => {
  const hostname = window.location.hostname;
  if (hostname === "localhost") {
    return "http://localhost:5000";
  }
  // On ngrok, server is on a different ngrok URL from client/.env
  return process.env.REACT_APP_SERVER_URL || "http://localhost:5000";
};

export const socket = io(getServerURL(), {
  transports: ["websocket", "polling"],
});