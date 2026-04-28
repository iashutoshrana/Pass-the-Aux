const { spawn } = require("child_process");
const fs = require("fs");
const axios = require("axios");

setTimeout(async () => {
  try {
    const res = await axios.get("http://localhost:4040/api/tunnels");
    const tunnels = res.data.tunnels;
    
    // ✅ Find specifically the port 5000 tunnel
    const serverTunnel = tunnels.find(t => t.config.addr.includes("5000"));
    
    if (!serverTunnel) {
      console.log("Port 5000 tunnel not found! Make sure ngrok http 5000 is running.");
      return;
    }

    const serverUrl = serverTunnel.public_url;
    console.log("Server ngrok URL:", serverUrl);

    const envPath = "./client/.env";
    let env = fs.readFileSync(envPath, "utf8");
    env = env.replace(/REACT_APP_SERVER_URL=.*/, `REACT_APP_SERVER_URL=${serverUrl}`);
    fs.writeFileSync(envPath, env);
    console.log("client/.env updated ✅");
  } catch (err) {
    console.error("Failed to get ngrok URL:", err.message);
  }
}, 3000);