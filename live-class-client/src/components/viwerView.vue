<!-- components/ViewerView.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";

const localVideo = ref(null);
const remoteVideos = ref([]);
// This remoteVideos array will include both the broadcaster’s stream and streams from other viewers.
const roomId = "live-class-room-123";
const socket = io("https://d-live.onrender.com/one-to-many", {
  transports: ["websocket"],
  withCredentials: true,
});
const peerConnections = {};
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let localStream = null;
let myId = null;

// Capture local media (camera and microphone)
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // Optionally display your local stream as self-preview:
    localVideo.value.srcObject = localStream;
  } catch (err) {
    console.error("Failed to access media devices", err);
  }
}

// Create a new RTCPeerConnection and add local tracks if available.
function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // If available, add local media so that this peer sends its stream
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  // Handle ICE candidates for this connection
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // For connections with the broadcaster, we use a common "ice-candidate" event.
      // For viewer-to-viewer, the same channel can be used (ensure your signaling server distinguishes them if needed).
      socket.emit("ice-candidate", {
        targetId: peerId,
        candidate: event.candidate,
      });
    }
  };

  // When a remote track is received, add (or update) the remoteVideos array.
  pc.ontrack = (event) => {
    if (!remoteVideos.value.find((v) => v.id === peerId)) {
      remoteVideos.value.push({ id: peerId, stream: event.streams[0] });
    }
  };

  peerConnections[peerId] = pc;
  return pc;
}

onMounted(async () => {
  // Start capturing local video & audio
  await startLocalStream();
  socket.emit("join-class", {
    classId: roomId,
    role: "viewer",
  });

  // Capture own socket.id when connected
  socket.on("connect", () => {
    myId = socket.id;
    // Inform other viewers that a new viewer has joined.
    // The server should broadcast this new viewer event to all other viewers.
    socket.emit("new-viewer", { viewerId: myId });
  });

  // 1. Handle the broadcaster's offer as before.
  socket.on("offer", async ({ offer, senderId }) => {
    // This could be the broadcaster sending its offer.
    // Create a peer connection (if not already created) and handle the offer.
    let pc = peerConnections[senderId];
    if (!pc) {
      pc = createPeerConnection(senderId);
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { broadcasterId: senderId, answer });
  });

  // 2. Handle the answer from the broadcaster (or from another viewer in a viewer-to-viewer connection)
  socket.on("answer", async ({ answer, senderId }) => {
    const pc = peerConnections[senderId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  // 3. Handle ICE candidates (common for all connections)
  socket.on("ice-candidate", async ({ candidate, senderId }) => {
    const pc = peerConnections[senderId];
    if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
  });

  // 4. --- New Section: Viewer-to-viewer connections ---
  // a) When a new viewer joins (other than myself), existing viewers will receive a "new-viewer" event.
  socket.on("new-viewer", async ({ viewerId }) => {
    if (viewerId === myId) return; // Skip if it's my own notification.
    // Create a connection to the new viewer and initiate the call
    const pc = createPeerConnection(viewerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // Send the offer under a specific event for viewer-to-viewer signaling.
    socket.emit("viewer-offer", { targetId: viewerId, offer });
  });

  // b) Handle incoming viewer-offers from other viewers.
  socket.on("viewer-offer", async ({ offer, senderId }) => {
    const pc = createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("viewer-answer", { targetId: senderId, answer });
  });

  // c) Handle answers to viewer-offers initiated by this client.
  socket.on("viewer-answer", async ({ answer, senderId }) => {
    const pc = peerConnections[senderId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  // 5. Clean up connections when a user leaves.
  socket.on("user-left", (id) => {
    const pc = peerConnections[id];
    if (pc) pc.close();
    delete peerConnections[id];
    remoteVideos.value = remoteVideos.value.filter((v) => v.id !== id);
  });
});

onUnmounted(() => {
  socket.emit("leave-class", { classId: roomId });
  socket.disconnect();
  Object.values(peerConnections).forEach((pc) => pc.close());
  localStream?.getTracks().forEach((track) => track.stop());
});
</script>

<template>
  <div>
    <h2 class="text-lg font-bold mb-2">👀 Viewer Stream</h2>
    <!-- Optional self-preview for viewer -->
    <div class="mb-4">
      <h3 class="text-md font-semibold">My Video (Self Preview):</h3>
      <video ref="localVideo" autoplay muted playsinline class="w-full rounded shadow" />
    </div>
    <!-- Remote streams: includes broadcaster and other viewers -->
    <div>
      <h3 class="text-md font-semibold mb-2">Remote Streams:</h3>
      <div
        class="grid gap-4"
        :class="{
          'grid-cols-1': remoteVideos.length === 1,
          'grid-cols-2': remoteVideos.length === 2,
          'grid-cols-3': remoteVideos.length >= 3 && remoteVideos.length < 5,
          'grid-cols-4': remoteVideos.length >= 5,
        }"
      >
        <video
          v-for="video in remoteVideos"
          :key="video.id"
          autoplay
          playsinline
          class="w-full aspect-video rounded border shadow"
          :srcObject="video.stream"
        ></video>
      </div>
    </div>
  </div>
</template>
