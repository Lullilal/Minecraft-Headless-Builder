
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.json({
    project: "Minecraft Headless Builder",
    status: "Backend running",
    version: "1.0.0"
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    server: "online",
    minecraftClients: 0,
    maxClients: 2,
    activeBuilds: 0
  });
});

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);

  socket.emit("welcome", {
    message: "Connected to Minecraft Builder backend"
  });

  socket.on("disconnect", () => {
    console.log("Dashboard disconnected:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
