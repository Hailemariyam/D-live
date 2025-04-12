export default function(io) {
    io.on("connection", (socket) => {
      console.log(`🔵 [One-to-One] User connected: ${socket.id}`);

      // Join room: expects { roomId }
      socket.on("join-room", ({ roomId }) => {
        socket.join(roomId);
        // Notify the other participant about a new user
        socket.to(roomId).emit("user-joined", socket.id);
      });

      // Handle WebRTC offer exchange
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
  };
