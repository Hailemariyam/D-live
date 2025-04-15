<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideos = ref({});

// Configs
const classId = "class-room-123";
const role = "host"; // or "viewer"
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket", "polling"],
  withCredentials: true,
});

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let localStream;
const peerConnections = new Map(); // socketId -> RTCPeerConnection
const iceCandidateQueues = new Map(); // socketId -> [candidates]

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (err) {
    console.error("❌ Media error:", err);
  }
}

function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { classId, candidate: event.candidate, targetId: peerId });
    }
  };

  pc.ontrack = (event) => {
    remoteVideos.value[peerId] = event.streams[0];
  };

  peerConnections.set(peerId, pc);
  return pc;
}

socket.on("host-joined", (hostId) => {
  console.log("Host joined:", hostId);
});

socket.on("user-joined", async (viewerId) => {
  if (role === "host") {
    console.log("Viewer joined:", viewerId);
    const pc = createPeerConnection(viewerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { classId, offer, targetId: viewerId });
  }
});

socket.on("offer", async ({ offer, senderId }) => {
  if (role === "viewer") {
    const pc = createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { classId, answer, targetId: senderId });
  }
});

socket.on("answer", async ({ answer, senderId }) => {
  const pc = peerConnections.get(senderId);
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on("ice-candidate", async ({ candidate, senderId }) => {
  const pc = peerConnections.get(senderId);
  if (pc && pc.remoteDescription) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } else {
    if (!iceCandidateQueues.has(senderId)) {
      iceCandidateQueues.set(senderId, []);
    }
    iceCandidateQueues.get(senderId).push(candidate);
  }
});

onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", { classId, role });
});

onUnmounted(() => {
  socket.emit("leave-class", { classId });
  socket.disconnect();

  for (const pc of peerConnections.values()) {
    pc.close();
  }

  peerConnections.clear();
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl font-bold">Live Class ({{ role }})</h2>
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <h3 class="text-lg font-semibold">Local Stream</h3>
        <video ref="localVideo" autoplay playsinline muted class="w-full rounded border"></video>
      </div>
      <div v-for="(stream, id) in remoteVideos" :key="id">
        <h3 class="text-lg font-semibold">Remote Stream - {{ id }}</h3>
        <video :ref="el => (el ? (el.srcObject = stream) : null)" autoplay playsinline class="w-full rounded border" />
      </div>
    </div>
  </div>
</template>
