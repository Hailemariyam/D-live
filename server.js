// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");

// const app = express();
// const PORT = process.env.PORT || 8080;

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: ["https://dlive.degantechnologies.com"],
//     methods: ["GET", "POST"],
//     transports: ["websocket", "polling"],
//     credentials: true,
//   },
// });

// // Serve a simple homepage for testing
// app.get("/", (req, res) => {
//   res.send("WebSocket Server is running");
// });

// io.on("connection", (socket) => {
//   console.log(`User connected: ${socket.id}`);

//   socket.on("join-class", ({ classId }) => {
//     socket.join(classId);
//     io.to(classId).emit("user-joined", socket.id);
//     console.log(`User ${socket.id} joined class ${classId}`);
//   });

//   socket.on("offer", ({ classId, offer, senderId }) => {
//     socket.to(classId).emit("offer", { offer, senderId });
//   });

//   socket.on("answer", ({ classId, answer, senderId }) => {
//     socket.to(classId).emit("answer", { answer, senderId });
//   });

//   socket.on("ice-candidate", ({ classId, candidate, senderId }) => {
//     socket.to(classId).emit("ice-candidate", { candidate, senderId });
//   });

//   socket.on("leave-class", ({ classId }) => {
//     socket.leave(classId);
//     io.to(classId).emit("user-left", socket.id);
//   });

//   socket.on("disconnect", () => {
//     console.log(`User disconnected: ${socket.id}`);
//     io.emit("user-disconnected", socket.id);
//   });
// });

// server.listen(PORT, () => {
//   console.log(`✅ WebSocket Server running on port ${PORT}`);
// });


// server.js

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const twilio = require("twilio");

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration for your production domain
const io = new Server(server, {
  cors: {
    origin: ["https://dlive.degantechnologies.com"],
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true,
  },
});

// Import your socket handlers
const oneToOneHandler = require("./socket/oneToOneHandler");
const oneToManyHandler = require("./socket/oneToManyHandler");

/**
 * API endpoint for generating a temporary TURN token from Twilio.
 * Ensure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are set.
 */
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

app.get("/api/v1/turn", async (req, res) => {
  try {
    const token = await client.tokens.create();
    // Optionally, you could customize the returned data.
    res.json({ iceServers: token.iceServers });
  } catch (error) {
    console.error("Error creating TURN token:", error);
    res.status(500).json({ error: "Error generating TURN token", details: error.message });
  }
});

// Serve the frontend Vue app build
const frontendPath = path.join(__dirname, "live-class-client/dist");
app.use(express.static(frontendPath));

// Frontend fallback for Vue Router
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


// Set up Socket.IO namespaces
const oneToOneNamespace = io.of("/one-to-one");
oneToOneHandler(oneToOneNamespace);

const oneToManyNamespace = io.of("/one-to-many");
oneToManyHandler(oneToManyNamespace);

// API endpoint for frontend to fetch WebSocket URLs
app.get("/api/v1/live/one-to-one", (req, res) => {
  res.json({ socketUrl: "https://d-live.onrender.com/one-to-one" });
});

app.get("/api/v1/live/one-to-many", (req, res) => {
  res.json({ socketUrl: "https://d-live.onrender.com/one-to-many" });
});


// Start the HTTP server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
