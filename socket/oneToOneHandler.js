function oneToOneHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🔵 [One-to-One] User connected: ${socket.id}`);

    socket.on("join-room", ({ roomId }) => {
      socket.join(roomId);
      socket.to(roomId).emit("user-joined", socket.id);
    });

    socket.on("offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("offer", { offer, senderId: socket.id });
    });

    socket.on("answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("answer", { answer, senderId: socket.id });
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("ice-candidate", { candidate });
    });

    socket.on("disconnect", () => {
      console.log(`🔵 [One-to-One] User disconnected: ${socket.id}`);
    });
  });
}

module.exports = oneToOneHandler;
