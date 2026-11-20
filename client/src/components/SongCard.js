// One row in the "Up Next" list.
export default function SongCard({ song, isPlaying, hasVoted, onVote }) {
  return (
    <div
      className="song-card"
      style={
        isPlaying
          ? {
              borderColor: "rgba(168,85,247,0.5)",
              background: "rgba(168,85,247,0.1)",
            }
          : {}
      }
    >
      <div style={{ position: "relative" }}>
        <img src={song.thumbnail} alt="" className="thumbnail" />
        {isPlaying && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(168,85,247,0.4)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            ▶
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.82rem",
            margin: "0 0 6px 0",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: isPlaying ? "#a855f7" : "inherit",
          }}
        >
          {song.title}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#ec4899", fontWeight: 600 }}>
            🔥 {song.votes}
          </span>
          <button
            onClick={onVote}
            disabled={hasVoted}
            style={{
              background: hasVoted ? "rgba(168,85,247,0.15)" : "transparent",
              border: "1px solid",
              borderColor: hasVoted
                ? "rgba(168,85,247,0.3)"
                : "rgba(168,85,247,0.6)",
              color: hasVoted ? "rgba(168,85,247,0.4)" : "#a855f7",
              borderRadius: "6px",
              cursor: hasVoted ? "not-allowed" : "pointer",
              fontSize: "0.68rem",
              padding: "3px 8px",
              fontWeight: 700,
              letterSpacing: "0.3px",
              transition: "all 0.2s ease",
            }}
          >
            {hasVoted ? "✓ Voted" : "VOTE"}
          </button>
        </div>
      </div>
    </div>
  );
}
