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
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

// Simple connection state tracker other components can subscribe to
let connectionListeners = [];

export const onConnectionChange = (callback) => {
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter((cb) => cb !== callback);
  };
};

const notifyListeners = (status) => {
  connectionListeners.forEach((cb) => cb(status));
};

socket.on("connect", () => {
  console.log("✅ Connected to server");
  notifyListeners({ status: "connected" });
});

socket.on("disconnect", (reason) => {
  console.warn("⚠️ Disconnected from server:", reason);
  notifyListeners({ status: "disconnected", reason });
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
  notifyListeners({ status: "error", message: err.message });
});

socket.on("reconnect_attempt", (attempt) => {
  console.log(`🔄 Reconnect attempt ${attempt}...`);
  notifyListeners({ status: "reconnecting", attempt });
});

socket.on("reconnect_failed", () => {
  console.error("❌ Failed to reconnect after max attempts");
  notifyListeners({ status: "failed" });
});