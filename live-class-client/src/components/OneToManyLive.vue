<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideos = reactive({}); // multiple viewers

const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
});

const classId = "class-room-123";
const role = "host";

let localStream;
const peerConnections = {}; // key: viewerId

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.value.srcObject = localStream;
  } catch (error) {
    console.error("Error accessing local media", error);
  }
}

function createPeerConnection(viewerId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        classId,
        candidate: event.candidate,
        targetId: viewerId,
      });
    }
  };

  // Not used for host, but added for completeness
  pc.ontrack = event => {
    remoteVideos[viewerId] = event.streams[0];
  };

  peerConnections[viewerId] = pc;
  return pc;
}

async function handleNewViewer(viewerId) {
  const pc = createPeerConnection(viewerId);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", {
    classId,
    offer,
    targetId: viewerId,
  });
}

socket.on("user-joined", async viewerId => {
  console.log("Viewer joined:", viewerId);
  await handleNewViewer(viewerId);
});

socket.on("answer", async ({ senderId, answer }) => {
  const pc = peerConnections[senderId];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on("ice-candidate", async ({ senderId, candidate }) => {
  const pc = peerConnections[senderId];
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate", err);
    }
  }
});

onMounted(async () => {
  await startLocalStream();
  socket.emit("join-class", { classId, role });
});

onUnmounted(() => {
  socket.emit("leave-class", { classId });
  socket.disconnect();

  Object.values(peerConnections).forEach(pc => pc.close());
});
</script>

<template>
  <div>
    <h2 class="text-xl font-bold">Live Class (Host)</h2>
    <div class="flex gap-4">
      <div>
        <h3>Local Stream</h3>
        <video ref="localVideo" autoplay playsinline muted class="w-full border rounded" />
      </div>
    </div>
    <div class="mt-4">
      <h3 class="text-lg font-semibold">Remote Viewers</h3>
      <div class="grid grid-cols-2 gap-4">
        <div v-for="(stream, id) in remoteVideos" :key="id">
          <video :ref="el => el && (el.srcObject = stream)" autoplay playsinline class="w-full border rounded" />
          <p class="text-sm text-center mt-1">{{ id }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
