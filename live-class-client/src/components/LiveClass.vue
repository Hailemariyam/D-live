<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideo = ref(null);

const socket = io("https://degan-live.up.railway.app", {
  transports: ["websocket", "polling"],
  withCredentials: true,
});
socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
});
socket.on("connect_timeout", (error) => {
  console.error("Connection timeout:", error);
});

socket.on("connect", () => {
  console.log("Connected to WebSocket server");
});
socket.on("disconnect", () => {
  console.log("Disconnected from WebSocket server");
});

const classId = "12345";
let localStream;
let peerConnection;

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// 📌 Capture Local Video
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

// 📌 Initialize WebRTC
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { classId, candidate: event.candidate });
    }
  };
}

// 📌 Send Offer when User Joins
async function startCall() {
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", { classId, offer });
}

// 📌 Handle Incoming WebRTC Offers

socket.on("offer", async (offer) => {
  console.log("Received offer:", offer);
  if (!peerConnection) createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  console.log("Sending answer:", answer);
  socket.emit("answer", { classId, answer });
});

// 📌 Handle WebRTC Answers
socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// 📌 Handle ICE Candidates
socket.on("ice-candidate", async (candidate) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// 📌 Join Class & Start Local Stream
onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", { classId });

  // Start call only if there are 2+ users
  socket.on("user-joined", async () => {
    if (!peerConnection) {
      await startCall();
    }
  });
});

// 📌 Clean Up on Leave
onUnmounted(() => {
  socket.emit("leave-class", { classId });
  socket.disconnect();
  if (peerConnection) peerConnection.close();
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl font-bold">Live Class</h2>

    <div class="flex">
      <div class="w-2/3 flex gap-4">
        <div>
          <h3 class="text-lg font-semibold">Local User</h3>
          <video ref="localVideo" autoplay playsinline class="w-full border rounded"></video>
        </div>
        <div>
          <h3 class="text-lg font-semibold">Remote User</h3>
          <video ref="remoteVideo" autoplay playsinline class="w-full border rounded"></video>
        </div>
      </div>
    </div>
  </div>
</template>
