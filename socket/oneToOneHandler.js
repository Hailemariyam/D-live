function oneToOneHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🔵 [One-to-One] User connected: ${socket.id}`);

    socket.on("join-class", ({ classId }) => {
      socket.join(classId);
      socket.to(classId).emit("user-joined", socket.id);
    });

    socket.on("leave-class", ({ classId }) => {
      socket.leave(classId);
      socket.to(classId).emit("user-left", socket.id);
    });

    socket.on("offer", ({ classId, offer }) => {
      socket.to(classId).emit("offer", { offer, senderId: socket.id });
    });

    socket.on("answer", ({ classId, answer }) => {
      socket.to(classId).emit("answer", { answer, senderId: socket.id });
    });

    socket.on("ice-candidate", ({ classId, candidate }) => {
      socket.to(classId).emit("ice-candidate", { candidate });
    });

    socket.on("disconnect", () => {
      console.log(`🔵 [One-to-One] User disconnected: ${socket.id}`);
    });
  });
}

module.exports = oneToOneHandler;
