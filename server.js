const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" }, // Allow all origins for testing
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

const PORT = 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
