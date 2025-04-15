function oneToManyHandler(io) {
  io.on("connection", (socket) => {
    console.log(`🟢 [One-to-Many] Connected: ${socket.id}`);

    // Join class: expects { classId, role }
    socket.on("join-class", ({ classId, role }) => {
      socket.join(classId);
      socket.data.classId = classId;
      socket.data.role = role;

      console.log(`👤 ${role.toUpperCase()} joined class ${classId}: ${socket.id}`);

      if (role === "host") {
        io.to(classId).emit("host-joined", socket.id);
      } else {
        io.to(classId).emit("user-joined", socket.id); // also triggers offer flow
      }
    });

    socket.on("offer", ({ classId, offer }) => {
      console.log(`📡 Offer from ${socket.id} in class ${classId}`);
      socket.to(classId).emit("offer", { offer, senderId: socket.id });
    });

    socket.on("answer", ({ classId, answer }) => {
      console.log(`📡 Answer from ${socket.id} in class ${classId}`);
      socket.to(classId).emit("answer", { answer, senderId: socket.id });
    });

    socket.on("ice-candidate", ({ classId, candidate }) => {
      console.log(`❄️ ICE candidate from ${socket.id} in class ${classId}`);
      socket.to(classId).emit("ice-candidate", { candidate });
    });

    socket.on("leave-class", ({ classId }) => {
      console.log(`🚪 ${socket.id} left class ${classId}`);
      socket.leave(classId);
      io.to(classId).emit("user-left", socket.id);
    });

    socket.on("disconnect", () => {
      const classId = socket.data?.classId;
      if (classId) {
        console.log(`🔌 Disconnected from class ${classId}: ${socket.id}`);
        io.to(classId).emit("user-left", socket.id);
      } else {
        console.log(`🔌 Disconnected (no class): ${socket.id}`);
      }
    });
  });
}

module.exports = oneToManyHandler;
