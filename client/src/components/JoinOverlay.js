// Shown before the first tap: browsers block autoplay with sound until the
// user interacts with the page.
export default function JoinOverlay({ song, onStart }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0d0d1a, #1a0030)",
        gap: "16px",
      }}
    >
      <img
        src={song.thumbnail}
        alt=""
        style={{
          width: "100px",
          borderRadius: "12px",
          opacity: 0.85,
          boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
        }}
      />
      <p style={{ opacity: 0.8, margin: 0, fontSize: "0.95rem", fontWeight: 500 }}>
        {song.title}
      </p>
      <button
        onClick={onStart}
        className="btn-primary"
        style={{ padding: "12px 32px", borderRadius: "30px", fontSize: "1rem" }}
      >
        ▶ Join the Party
      </button>
    </div>
  );
}
