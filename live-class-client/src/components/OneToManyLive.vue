<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideo = ref(null);

// Connect to the one-to-many namespace
const socket = io("https://degan-live-production.up.railway.app/one-to-many", {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

// Unique class identifier for the live session
const classId = "class-room-123";

// Define role: "host" for the instructor, "viewer" for students
// Adjust this variable as needed per session
const role = "host";

let localStream;
let peerConnection;
let iceCandidateQueue = [];
let isRemoteDescriptionSet = false;

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Capture the local video stream
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

// Create RTCPeerConnection and add local media tracks
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { classId, candidate: event.candidate });
    }
  };
}

// For the host: Create and send an offer so viewers can answer
async function startCall() {
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { classId, offer });
}

// Handle incoming offer (for viewers) or answer (for host)
socket.on("offer", async ({ offer, senderId }) => {
  console.log("Received offer from host:", senderId);
  // For viewers, create a connection if not already set up
  if (!peerConnection) createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  isRemoteDescriptionSet = true;

  // Buffer and add ICE candidates
  while (iceCandidateQueue.length > 0) {
    const candidate = iceCandidateQueue.shift();
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding buffered ICE candidate", error);
    }
  }

  // For viewers, answer back to host
  if (role === "viewer") {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { classId, answer });
  }
});

socket.on("answer", async ({ answer, senderId }) => {
  console.log("Received answer from viewer:", senderId);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  isRemoteDescriptionSet = true;
});

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

// Listening for new participants joining
socket.on("viewer-joined", async (userId) => {
  console.log(`Viewer joined: ${userId}`);
  // For host, start call upon first viewer joining if not already started
  if (role === "host" && !peerConnection) {
    await startCall();
  }
});

// Optionally, notify when host joins (for viewers)
socket.on("host-joined", async (userId) => {
  console.log(`Host joined: ${userId}`);
  // Viewers might want to await the offer coming next
});

// Leave class and cleanup
onMounted(async () => {
  await startLocalStream();
  // Emit join event along with role information
  socket.emit("join-class", { classId, role });
});

onUnmounted(() => {
  socket.emit("leave-class", { classId });
  socket.disconnect();
  if (peerConnection) peerConnection.close();
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl font-bold">Live Class ({{
      role === "host" ? "Host" : "Viewer"
    }})</h2>
    <div class="flex gap-4">
      <div>
        <h3 class="text-lg font-semibold">Local Stream</h3>
        <video ref="localVideo" autoplay playsinline muted class="w-full border rounded"></video>
      </div>
      <div>
        <h3 class="text-lg font-semibold">Remote Stream</h3>
        <video ref="remoteVideo" autoplay playsinline class="w-full border rounded"></video>
      </div>
    </div>
  </div>
</template>
