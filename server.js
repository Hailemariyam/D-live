const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 8080; // Railway will set the PORT to 8080
const server = http.createServer();

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: [
      "https://degan-live-production.up.railway.app", // Updated Railway domain
      "https://degan-live.vercel.app" // if needed
    ],
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ WebSocket Server running on port ${PORT}`);
});
