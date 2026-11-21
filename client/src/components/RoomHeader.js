// "Now Playing in <room>" row with the HOST badge, Skip and Leave buttons.
export default function RoomHeader({
  roomCode,
  isHost,
  onSkip,
  onLeave,
  canVoteSkip,
  skipVotes,
  skipNeeded,
  hasVotedSkip,
  onVoteSkip,
  participants,
}) {
  return (
    <div
      className="room-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "8px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "rgba(255,255,255,0.8)",
        }}
      >
        Now Playing in{" "}
        <span style={{ color: "#a855f7", fontWeight: 800 }}>{roomCode}</span>
        {isHost && (
          <span
            style={{
              marginLeft: "8px",
              fontSize: "0.65rem",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              padding: "3px 10px",
              borderRadius: "20px",
              verticalAlign: "middle",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            HOST
          </span>
        )}
        {/* live head-count: green dot + number of people in the room */}
        <span
          style={{
            marginLeft: "10px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            background: "rgba(255,255,255,0.08)",
            padding: "3px 10px",
            borderRadius: "20px",
            verticalAlign: "middle",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px #22c55e",
            }}
          />
          {participants} {participants === 1 ? "person" : "people"} here
        </span>
      </h2>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {/* Only host sees Skip (server also checks) */}
        {isHost && (
          <button
            onClick={onSkip}
            style={{
              padding: "8px 18px",
              borderRadius: "20px",
              border: "1px solid rgba(168,85,247,0.4)",
              background: "rgba(168,85,247,0.15)",
              color: "#a855f7",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.target.style.background = "rgba(168,85,247,0.3)")
            }
            onMouseLeave={(e) =>
              (e.target.style.background = "rgba(168,85,247,0.15)")
            }
          >
            ⏭ Skip
          </button>
        )}
        {/* Host sees how many guests want to skip */}
        {isHost && canVoteSkip && skipVotes > 0 && (
          <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
            {skipVotes}/{skipNeeded} want to skip
          </span>
        )}

        {/* Guests vote to skip; a majority skips the song */}
        {!isHost && canVoteSkip && (
          <button
            onClick={onVoteSkip}
            disabled={hasVotedSkip}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "1px solid rgba(168,85,247,0.4)",
              background: hasVotedSkip
                ? "rgba(168,85,247,0.08)"
                : "rgba(168,85,247,0.15)",
              color: hasVotedSkip ? "rgba(168,85,247,0.5)" : "#a855f7",
              cursor: hasVotedSkip ? "not-allowed" : "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {hasVotedSkip ? "Voted to skip" : "Vote to skip"} ({skipVotes}/
            {skipNeeded})
          </button>
        )}

        <button
          onClick={onLeave}
          title="Leave this party"
          style={{
            padding: "8px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
