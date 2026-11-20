// First screen: start a new party or join one with a code.
export default function HomeScreen({
  roomId,
  setRoomId,
  onCreate,
  onJoin,
  error,
}) {
  return (
    <div
      className="glass-card"
      style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}
    >
      <button
        className="btn-primary"
        style={{ width: "100%", fontSize: "1rem", padding: "16px" }}
        onClick={onCreate}
      >
        Start a New Party
      </button>

      <div
        style={{
          margin: "24px 0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "rgba(255,255,255,0.1)",
          }}
        />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>
          OR
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "rgba(255,255,255,0.1)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          className="input-glow"
          style={{ flex: 1 }}
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onJoin()}
        />
        <button className="btn-primary" onClick={onJoin}>
          Join
        </button>
      </div>

      {error && (
        <p style={{ color: "#f87171", marginTop: "14px", fontSize: "0.9rem" }}>
          ❌ {error}
        </p>
      )}
    </div>
  );
}
