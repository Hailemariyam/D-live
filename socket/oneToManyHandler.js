export default function(io) {
    io.on("connection", (socket) => {
      console.log(`🟢 [One-to-Many] User connected: ${socket.id}`);

      // Join class: expects { classId }
      socket.on("join-class", ({ classId }) => {
        socket.join(classId);
        // Notify all others in the class
        io.to(classId).emit("user-joined", socket.id);
      });

      // Handle WebRTC offer exchange for broadcasting
      socket.on("offer", ({ classId, offer }) => {
        socket.to(classId).emit("offer", { offer, senderId: socket.id });
      });

      socket.on("answer", ({ classId, answer }) => {
        socket.to(classId).emit("answer", { answer, senderId: socket.id });
      });

      socket.on("ice-candidate", ({ classId, candidate }) => {
        socket.to(classId).emit("ice-candidate", { candidate });
      });

      // Leave class: expects { classId }
      socket.on("leave-class", ({ classId }) => {
        socket.leave(classId);
        io.to(classId).emit("user-left", socket.id);
      });

      socket.on("disconnect", () => {
        console.log(`🟢 [One-to-Many] User disconnected: ${socket.id}`);
      });
    });
  };
