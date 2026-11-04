
const express = require("express");
const http = require("http");
const multer = require("multer");
const { Server } = require("socket.io");
const { parseSchematic } = require("./schematic");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_CLIENTS = 2;
const clients = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".schem")) {
      return cb(new Error("Only .schem files are allowed"));
    }
    cb(null, true);
  }
});

app.use(express.json());
app.use(express.static("public"));

function getStatus() {
  return {
    server: "online",
    minecraftClients: clients.size,
    maxClients: MAX_CLIENTS,
    activeBuilds: 0,
    clients: Array.from(clients.values())
  };
}

app.get("/api/status", (req, res) => {
  res.json(getStatus());
});

// Upload and parse a Sponge .schem file
app.post("/api/schematic", upload.single("schematic"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please select a .schem file"
      });
    }

    const schematic = await parseSchematic(req.file.buffer);

    res.json({
      success: true,
      filename: req.file.originalname,
      schematic
    });
  } catch (error) {
    res.status(400).json({
      error: error.message || "Could not parse schematic"
    });
  }
});

io.on("connection", (socket) => {
  console.log("Connection:", socket.id);

  socket.emit("welcome", {
    message: "Connected to Minecraft Builder backend"
  });

  socket.on("minecraft:status", (data) => {
    if (!data || typeof data.id !== "string") return;

    const allowedStatuses = ["connecting", "online", "offline"];
    if (!allowedStatuses.includes(data.status)) return;

    if (!clients.has(data.id) && clients.size >= MAX_CLIENTS) {
      socket.emit("client:limit", {
        message: "Maximum 2 clients allowed"
      });
      return;
    }

    clients.set(data.id, {
      id: data.id,
      status: data.status
    });

    io.emit("dashboard:update", getStatus());
  });

  socket.on("minecraft:remove", (data) => {
    if (!data || typeof data.id !== "string") return;

    clients.delete(data.id);
    io.emit("dashboard:update", getStatus());
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 10 MB."
        : err.message
    });
  }

  res.status(400).json({
    error: err.message || "Upload failed"
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
