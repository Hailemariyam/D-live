<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideo = ref(null);

// Connect to the one-to-one namespace
const socket = io("https://d-live.onrender.com/api/v1/live/one-to-one", {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

// Use a room identifier for the one-to-one call. This could be a unique session ID.
const roomId = "oneToOne-room-123";
let localStream;
let peerConnection;
let iceCandidateQueue = [];
let isRemoteDescriptionSet = false;

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Capture the local media stream
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

// Create a WebRTC PeerConnection and add local tracks
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { classId: roomId, candidate: event.candidate });
    }
  };
}

// Start call by creating offer and sending it via Socket.IO
async function startCall() {
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", { classId: roomId, offer });
}

// Handle incoming offer
socket.on("offer", async ({ offer, senderId }) => {
  console.log("Received offer from:", senderId);
  if (!peerConnection) createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  isRemoteDescriptionSet = true;

  // Process any buffered ICE candidates
  while (iceCandidateQueue.length) {
    const candidate = iceCandidateQueue.shift();
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding buffered ICE candidate", error);
    }
  }

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answer", { classId: roomId, answer });
});

// Handle incoming answer
socket.on("answer", async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  isRemoteDescriptionSet = true;
});

// Handle incoming ICE candidate
socket.on("ice-candidate", async ({ candidate }) => {
  if (isRemoteDescriptionSet) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding received ICE candidate", error);
    }
  } else {
    iceCandidateQueue.push(candidate);
  }
});

// Join room and start the call when a user joins the room
onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", { classId: roomId });

  socket.on("user-joined", async (userId) => {
    console.log(`User joined: ${userId}`);
    if (!peerConnection) {
      await startCall();
    }
  });

  socket.on("user-left", (userId) => {
    console.log(`User left: ${userId}`);
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
      remoteVideo.value.srcObject = null;
    }
  });
});

// Clean up resources when component unmounts
onUnmounted(() => {
  socket.emit("leave-class", { classId: roomId });
  socket.disconnect();
  if (peerConnection) peerConnection.close();
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl font-bold">One-to-One Video Call</h2>
    <div class="flex gap-4">
      <div>
        <h3 class="text-lg font-semibold">Local User</h3>
        <video ref="localVideo" autoplay playsinline muted class="w-full border rounded"></video>
      </div>
      <div>
        <h3 class="text-lg font-semibold">Remote User</h3>
        <video ref="remoteVideo" autoplay playsinline class="w-full border rounded"></video>
      </div>
    </div>
  </div>
</template>
