<!-- <script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideo = ref(null);

const socket = io("https://d-live.onrender.com", {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

const classId = "12345";
let localStream;
let peerConnection;
let iceCandidateQueue = [];
let isRemoteDescriptionSet = false;

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// 🟢 Capture Local Video Stream
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

// 🟢 Create WebRTC Peer Connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { classId, candidate: event.candidate, senderId: socket.id });
    }
  };
}

// 🟢 Initiate Video Call
async function startCall() {
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", { classId, offer, senderId: socket.id });
}

// 🟢 Handle Incoming Offer
socket.on("offer", async ({ offer, senderId }) => {
  console.log("Received offer from:", senderId);
  if (!peerConnection) createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  isRemoteDescriptionSet = true;

  // Add buffered ICE candidates
  while (iceCandidateQueue.length > 0) {
    const candidate = iceCandidateQueue.shift();
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Buffered ICE candidate added successfully.");
    } catch (error) {
      console.error("Error adding buffered ICE candidate", error);
    }
  }

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answer", { classId, answer, senderId: socket.id });
});

// 🟢 Handle Incoming Answer
socket.on("answer", async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  isRemoteDescriptionSet = true;
});

// 🟢 Handle Incoming ICE Candidate
socket.on("ice-candidate", async ({ candidate }) => {
  if (isRemoteDescriptionSet) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("ICE candidate added successfully.");
    } catch (error) {
      console.error("Error adding received ICE candidate", error);
    }
  } else {
    iceCandidateQueue.push(candidate);
    console.log("Buffered ICE candidate.");
  }
});

// 🟢 Join Class
onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", { classId });

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

// 🟢 Clean Up on Component Unmount
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
          <video ref="localVideo" autoplay playsinline muted class="w-full border rounded"></video>
        </div>
        <div>
          <h3 class="text-lg font-semibold">Remote User</h3>
          <video ref="remoteVideo" autoplay playsinline class="w-full border rounded"></video>
        </div>
      </div>
    </div>
  </div>
</template> -->

<template>
  <div class="live-container p-4">
    <h1 class="mb-6 text-2xl font-bold text-center">Degan Live</h1>

    <!-- Toggle Buttons -->
    <div class="flex justify-center gap-4 mb-6">
      <button
        @click="currentView = 'one-to-many'"
        :class="[
          'px-4 py-2 rounded font-medium',
          currentView === 'one-to-many'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
        ]"
      >
        One-to-Many
      </button>
      <button
        @click="currentView = 'one-to-one'"
        :class="[
          'px-4 py-2 rounded font-medium',
          currentView === 'one-to-one'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
        ]"
      >
        One-to-One
      </button>
    </div>

    <!-- Dynamic Component Rendering -->
    <div v-if="currentView === 'one-to-many'">
      <h2 class="text-xl font-semibold mb-2">Live Class (One-to-Many)</h2>
      <OneToManyLive />
    </div>

    <div v-if="currentView === 'one-to-one'">
      <h2 class="text-xl font-semibold mb-2">One-to-One Video Call</h2>
      <OneToOneLive />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import OneToOneLive from "./OneToOneLive.vue";
import OneToManyLive from "./OneToManyLive.vue";

// Reactive state for which view to show
const currentView = ref("one-to-many");
</script>

<style scoped>
.live-container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
