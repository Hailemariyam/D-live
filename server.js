const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://degan-livestream.vercel.app/"],
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true,
  },
});

// Serve a simple homepage for testing
app.get("/", (req, res) => {
  res.send("WebSocket Server is running");
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-class", ({ classId }) => {
    socket.join(classId);
    io.to(classId).emit("user-joined", socket.id);
    console.log(`User ${socket.id} joined class ${classId}`);
  });

  socket.on("offer", ({ classId, offer, senderId }) => {
    socket.to(classId).emit("offer", { offer, senderId });
  });

  socket.on("answer", ({ classId, answer, senderId }) => {
    socket.to(classId).emit("answer", { answer, senderId });
  });

  socket.on("ice-candidate", ({ classId, candidate, senderId }) => {
    socket.to(classId).emit("ice-candidate", { candidate, senderId });
  });

  socket.on("leave-class", ({ classId }) => {
    socket.leave(classId);
    io.to(classId).emit("user-left", socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    io.emit("user-disconnected", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket Server running on port ${PORT}`);
});
