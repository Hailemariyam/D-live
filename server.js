const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000; // Railway assigns a dynamic port
const HOST = "0.0.0.0"; // Allow external access

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: ["https://degan-live.vercel.app"], // Your frontend URL
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-class", ({ classId }) => {
    socket.join(classId);
    io.to(classId).emit("user-joined", socket.id);
  });

  socket.on("offer", ({ classId, offer }) => {
    socket.to(classId).emit("offer", offer);
  });

  socket.on("answer", ({ classId, answer }) => {
    socket.to(classId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ classId, candidate }) => {
    socket.to(classId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket Server running on port ${PORT}`);
});
