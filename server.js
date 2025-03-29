const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000; // Use Railway's dynamic port
const HOST = "0.0.0.0"; // Ensure external accessibility

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: ["https://degan-live.vercel.app/"], // Your frontend URL
    methods: ["GET", "POST"],
  },
});

const users = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-class", ({ classId }) => {
    if (!users[classId]) users[classId] = [];
    users[classId].push(socket.id);

    socket.join(classId);
    io.to(classId).emit("user-joined", socket.id);
  });

  socket.on("offer", ({ classId, offer }) => {
    console.log(`Received offer from ${socket.id}, forwarding to class ${classId}`);
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
    for (const classId in users) {
      users[classId] = users[classId].filter((id) => id !== socket.id);
      io.to(classId).emit("user-left", socket.id);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
