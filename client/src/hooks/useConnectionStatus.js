import { useState, useEffect } from "react";
import { onConnectionChange } from "../socket";

// Tracks the socket connection state for the reconnect banner.
export default function useConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = useState({
    status: "connected",
  });

  useEffect(() => {
    const unsubscribe = onConnectionChange((state) => {
      setConnectionStatus(state);
    });
    return unsubscribe;
  }, []);

  return connectionStatus;
}
