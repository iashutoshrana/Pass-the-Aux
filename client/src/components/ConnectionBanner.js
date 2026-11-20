// Yellow/red bar at the top when the server connection drops.
export default function ConnectionBanner({ status, attempt }) {
  if (status === "connected") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        textAlign: "center",
        padding: "10px",
        fontSize: "0.85rem",
        fontWeight: 600,
        background:
          status === "failed" ? "rgba(220,38,38,0.9)" : "rgba(234,179,8,0.9)",
        color: "#fff",
      }}
    >
      {status === "reconnecting" &&
        `🔄 Reconnecting to server... (attempt ${attempt})`}
      {status === "disconnected" && "⚠️ Disconnected from server..."}
      {status === "error" && "⚠️ Connection error, retrying..."}
      {status === "failed" &&
        "❌ Could not reconnect. Please refresh the page."}
    </div>
  );
}
