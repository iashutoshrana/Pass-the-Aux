import { QRCodeCanvas } from "qrcode.react";

function QRSection({ roomId }) {
  if (!roomId) return null;

  const joinLink = `http://localhost:3001/?room=${roomId}`;

 return (
    <div
      className="qr-section"
      style={{
        position: "fixed",
        top: "15px",
        right: "15px",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)", // Blurs the background for a premium look
        padding: "10px",
        borderRadius: "12px",
        textAlign: "center",
        zIndex: 1000,
        width: "110px", // Fixed width to keep it tiny
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
      }}
    >
      <h4 style={{ 
        margin: "0 0 8px 0", 
        color: "#a855f7", 
        fontSize: "0.65rem", 
        textTransform: "uppercase",
        letterSpacing: "0.5px"
      }}>
        Share Vibe
      </h4>

      <div
        style={{
          background: "white",
          padding: "5px",
          borderRadius: "6px",
          lineHeight: 0, // Removes extra bottom spacing
          display: "inline-block",
        }}
      >
        <QRCodeCanvas value={joinLink} size={90} /> {/* Shrink from 120 to 90 */}
      </div>

      <p style={{ 
        fontSize: "0.55rem", 
        marginTop: "6px", 
        opacity: 0.5,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis" // Prevents the long URL from breaking the box
      }}>
        {roomId}
      </p>
    </div>
  );
}

export default QRSection;