import { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

function QRSection({ roomId }) {
  const [copied, setCopied] = useState(false);
  const [big, setBig] = useState(false);

  // close the big QR with the Escape key
  useEffect(() => {
    if (!big) return;
    const onKey = (e) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  if (!roomId) return null;

  const joinLink = `${window.location.origin}/?room=${roomId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <>
      <div
        className="qr-section"
        style={{
          boxSizing: "border-box",
          width: "170px",
          height: "170px", // square card
          margin: "0 auto 16px",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          background:
            "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.08))",
          border: "1px solid rgba(168,85,247,0.3)",
          borderRadius: "16px",
        }}
      >
        {/* QR centered in its own white square */}
        <div
          onClick={() => setBig(true)}
          title="Click to enlarge"
          style={{
            background: "white",
            padding: "5px",
            borderRadius: "10px",
            lineHeight: 0,
            cursor: "zoom-in",
          }}
        >
          <QRCodeCanvas value={joinLink} size={90} level="M" />
        </div>

        <div
          style={{
            fontFamily: "monospace",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "2px",
            color: "#d8b4fe",
          }}
        >
          {roomId}
        </div>

        <button
          onClick={copyLink}
          style={{
            background: "transparent",
            border: "1px solid rgba(168,85,247,0.6)",
            color: "#a855f7",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "0.62rem",
            padding: "3px 10px",
            fontWeight: 700,
            letterSpacing: "0.3px",
          }}
        >
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>

      {big && (
        <div
          onClick={() => setBig(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "16px",
              borderRadius: "16px",
              lineHeight: 0,
            }}
          >
            <QRCodeCanvas value={joinLink} size={300} level="M" />
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "1.6rem",
              fontWeight: 700,
              letterSpacing: "4px",
            }}
          >
            {roomId}
          </div>
          <div style={{ opacity: 0.6, fontSize: "0.85rem" }}>
            Scan to join · click anywhere to close
          </div>
        </div>
      )}
    </>
  );
}

export default QRSection;
