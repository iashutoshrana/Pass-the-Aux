// Shown when the last song has finished.
export default function PartyEnded({ onExit }) {
  const focusSearch = () => {
    const el = document.querySelector(".search-container .input-glow");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  return (
    <>
      <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>🎉</div>
      <h2
        style={{
          margin: 0,
          fontSize: "2rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, #a855f7, #ec4899)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Party ends here
      </h2>
      <p style={{ margin: 0, opacity: 0.7, fontSize: "1rem" }}>
        That was the last song. Thanks for the vibes!
      </p>
      <button
        className="btn-primary"
        style={{ marginTop: "8px", padding: "10px 26px", borderRadius: "30px" }}
        onClick={focusSearch}
      >
        🎵 Add more songs
      </button>
      <button className="btn-exit" onClick={onExit}>
        Exit party
      </button>
    </>
  );
}
