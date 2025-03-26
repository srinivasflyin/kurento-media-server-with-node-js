let ws;
let peerConnection;
let localStream;
let isScreenSharing = false;
const remoteVideos = {};
const midToParticipantMap = {};
const joinBreakoutRoomButton = document.getElementById('joinBreakoutRoomButton');
const joinBreakoutRoomButton2 = document.getElementById('joinBreakoutRoomButton2');
const leaveBreakoutRoomButton = document.getElementById('leaveBreakoutRoom');
const leaveBreakoutRoomButton2 = document.getElementById('leaveBreakoutRoom2');
const sendEmojiButton1 = document.getElementById('sendEmojiButton1');
const sendEmojiButton2 = document.getElementById('sendEmojiButton2');
const sendEmojiButton3 = document.getElementById('sendEmojiButton3');
const sendEmojiButton4 = document.getElementById('sendEmojiButton4');
const startCallButton = document.getElementById('startCallButton');
const shareScreenButton = document.getElementById('shareScreenButton');
const stopCallButton = document.getElementById('stopCallButton');
const raiseHandButton = document.getElementById('raiseHandButton');
const sendMessageButton = document.getElementById('sendMessage');
const chatInputBox = document.getElementById('chatInput');
let name = prompt("Enter your name:");
console.log('fffffffffffffff', ws);
const userId = function generateUserId() {
  return 'user-' + Math.random().toString(36).substr(2, 9);
}()

joinBreakoutRoomButton.onclick = () => joinBreakoutRoom('Room 1');
joinBreakoutRoomButton2.onclick = () => joinBreakoutRoom('Room 2');
leaveBreakoutRoomButton.onclick = () => leaveBreakoutRoom('Room 1');
leaveBreakoutRoomButton2.onclick = () => leaveBreakoutRoom('Room 2');
sendEmojiButton1.onclick = () => sendEmoji('😂');
sendEmojiButton2.onclick = () => sendEmoji('❤️');
sendEmojiButton3.onclick = () => sendEmoji('👍');
sendEmojiButton4.onclick = () => sendEmoji('🔥');
startCallButton.onclick = () => startCall();
stopCallButton.onclick = () => stopCall();
shareScreenButton.onclick = () => shareScreen();
raiseHandButton.onclick = () => raiseHand();

sendMessageButton.onclick = () => {
  const message = chatInput.value.trim();
  if (message) {
    sendMessage({ id: 'chat', from: name, message, userId });
    console.log('============sendMessageButton===========================', userId)
    displayMessage(name, message, true); // Display local message
    chatInputBox.value = '';
  }
};


// Function to display messages in the chat box
function displayMessage(from, message, isLocal) {
  console.log('==============displayMessage==========')
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', isLocal ? 'local' : 'remote');
  messageElement.innerHTML = `
    <div>
      <div class="username">${from}</div>
      <div class="bubble">${message}</div>
      <div class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `;

  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
  console.log('==============displayMessage==========end')
}

  // ✅ Remove participant on disconnect
  function removeParticipant (participantId) {
    console.log(`👋 Removing participant with ID: ${participantId}`);

    const mid = Object.keys(midToParticipantMap).find(
      (key) => midToParticipantMap[key] === participantId
    );

    if (mid && remoteVideos[mid]) {
      // Stop the stream
      remoteVideos[mid].srcObject.getTracks().forEach(track => track.stop());
      remoteVideos[mid].srcObject = null;
      // Remove the video element from the DOM
      remoteVideos[mid].parentNode.removeChild(remoteVideos[mid]);

      // Clean up mapping
      delete midToParticipantMap[mid];
      delete remoteVideos[mid];
    }
  };


async function startCall() {
  console.log('startCall=========================================');
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  applyBackgroundBlur();

  // ✅ Display local video
  document.getElementById('localVideo').srcObject = localStream;

  peerConnection = new RTCPeerConnection();

  // ✅ Send local tracks to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // ✅ Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ id: 'iceCandidate', candidate: event.candidate }));
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('🎥 Remote track received:', event.streams);

    // Map the mid to the WebSocket ID (if known)
    if (event.transceiver.mid) {
      midToParticipantMap[event.transceiver.mid] = ws.id;
    }

    // Display the remote video
    if (!remoteVideos[event.transceiver.mid]) {
      const videoGrid = document.getElementById('videoGrid');
      const remoteVideo = document.createElement('video');
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.controls = true;
      videoGrid.appendChild(remoteVideo);
      remoteVideos[event.transceiver.mid] = remoteVideo;
    }
  };

  // ✅ Handle incoming remote streams
  // peerConnection.ontrack = (event) => {
  //   console.log('🎥 Remote track received:', event.streams);
  //   const remoteVideo = document.getElementById('remoteVideo');

  //   if (remoteVideo.srcObject !== event.streams[0]) {
  //     remoteVideo.srcObject = event.streams[0];
  //   }

  // };


  //const participants = {}; // Track all active participants

  // ✅ Handle incoming remote streams
  // peerConnection.ontrack = (event) => {
  //   console.log('🎥 Remote track received:', event.streams);

  //   const participantId = event.transceiver.mid; // Use transceiver ID to track participant
  //   let remoteVideo = participants[participantId];

  //   if (!remoteVideo) {
  //     console.log(`🔔 New participant joined: ${participantId}`);

  //     // Create a new video element for each participant
  //     remoteVideo = document.createElement('video');
  //     remoteVideo.id = `participant-${participantId}`;
  //     remoteVideo.autoplay = true;
  //     remoteVideo.playsInline = true;
  //     remoteVideo.controls = false; // Optional
  //     remoteVideo.style.width = '200px'; // Example size
  //     remoteVideo.style.margin = '5px';
  //     remoteVideo.style.borderRadius = '8px';
  //     remoteVideo.style.objectFit = 'cover';

  //     // Add to the video grid or container
  //     document.getElementById('videoContainer').appendChild(remoteVideo);

  //     // Store in participants object
  //     participants[participantId] = remoteVideo;
  //   }

  //   // Attach the stream to the video element
  //   if (remoteVideo.srcObject !== event.streams[0]) {
  //     remoteVideo.srcObject = event.streams[0];
  //   }
  // };




  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  console.log('Sending SDP Offer:', offer.sdp);
  ws.send(JSON.stringify({ id: 'start', sdpOffer: offer.sdp, name }));
}


function stopCall() {
  ws.send(JSON.stringify({ id: 'stop' }));
  localStream.getTracks().forEach(track => track.stop());
}


function sendMessage({ id, from, message, userId }) {
  console.log('sendMessageTextBox', message);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ id, from, message,userId }));
  } else {
    console.error('WebSocket is not open. Current state:', ws.readyState);
  }
}

function sendEmoji(emoji) {
  ws.send(JSON.stringify({ id: 'emoji', from: name, emoji }));
}

function raiseHand() {
  ws.send(JSON.stringify({ id: 'emoji', from: name, emoji: '✋' }));
}

// async function shareScreen() {
//   if (!isScreenSharing) {
//     try {
//       const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//       const screenTrack = screenStream.getTracks()[0];

//       peerConnection.addTrack(screenTrack, screenStream);
//       isScreenSharing = true;

//       screenTrack.onended = () => stopScreenSharing();
//     } catch (err) {
//       console.error('Error sharing screen:', err);
//     }
//   }
// }

async function shareScreen() {
  if (!isScreenSharing) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor"
        },
        audio: false
      });

      const screenTrack = screenStream.getTracks()[0];

      // Replace existing track if present
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
      
      if (videoSender) {
        videoSender.replaceTrack(screenTrack);
      } else {
        peerConnection.addTrack(screenTrack, screenStream);
      }

      isScreenSharing = true;

      // Handle stopping the screen share
      screenTrack.onended = () => stopScreenSharing();
      
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.error('Permission denied: User denied screen sharing.');
        alert('You need to allow screen sharing permissions.');
      } else if (err.name === 'NotFoundError') {
        console.error('No display media devices found.');
      } else if (err.name === 'AbortError') {
        console.error('Screen sharing aborted.');
      } else if (err.name === 'SecurityError') {
        console.error('Screen sharing is blocked due to security settings.');
      } else {
        console.error('Error sharing screen:', err);
      }
    }
  }
}


function stopScreenSharing() {
  isScreenSharing = false;
}

function applyBackgroundBlur() {
  const video = document.getElementById('localVideo');
  const stream = video.srcObject;
  if (stream && stream.getVideoTracks && stream.getVideoTracks[0]) {
    const track = stream.getVideoTracks()[0];
    const processor = new OffscreenCanvas(track.getSettings().width, track.getSettings().height).getContext('2d');
    processor.filter = 'blur(10px)';
    processor.drawImage(video, 0, 0);
  }
}

function joinBreakoutRoom(room) {
  console.log('f');
  ws.send(JSON.stringify({ id: 'joinBreakoutRoom', room }));
}

function leaveBreakoutRoom(room) {
  ws.send(JSON.stringify({ id: 'leaveBreakoutRoom', room }));
}

function showEmoji(from, emoji) {
  const emojiDisplay = document.createElement('div');
  emojiDisplay.innerText = `${from}: ${emoji}`;
  emojiDisplay.classList.add('emoji');
  document.body.appendChild(emojiDisplay);

  setTimeout(() => emojiDisplay.remove(), 3000);
}


function approveParticipant(id) {
  ws.send(JSON.stringify({ id: 'waitingRoomApproval', id }));
}




function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log('WebSocket already connected');
    return;
  }

  ws = new WebSocket('ws://localhost:3000');

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onclose = (event) => {
    console.log('WebSocket closed:', event);
    setTimeout(connectWebSocket, 1000); // Try to reconnect after 1 second
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    switch (data.id) {
      case 'chatMessage':
        // const chatBox = document.getElementById('chatBox');
        // chatBox.innerHTML += `<p><strong>${data.from}:</strong> ${data.message}</p>`;
        console.log('=========================chatMessage=======================', data.userId, ws.id);
        if(data.userId && data.userId !==userId)
        displayMessage(data.from, data.message, false);
        break;
      case 'emoji':
        showEmoji(data.from, data.emoji);
        break;
      case 'screenShareRequest':
        if (confirm(`${data.from} wants to share their screen. Allow?`)) {
          ws.send(JSON.stringify({ id: 'screenSharePermission', granted: true }));
        }
        break;
      case 'participantApproved':
        console.log('participantApproved==================');
        document.getElementById('waitingRoom').style.display = 'none';
        break;
      case 'waitingRoomApproval':
        // ✅ Display participant approval request
        const waitingRoom = document.getElementById('waitingRoom');
        const participantItem = document.createElement('div');
        participantItem.innerHTML = `
        <span>${data.id} wants to join</span>
        <button onclick="approveParticipant('${data.id}')">Approve</button>
      `;
        waitingRoom.appendChild(participantItem);
        break;

      case 'sdpAnswer':
        console.log('✅ Received SDP Answer:', data.sdpAnswer);

        // ✅ Set the remote description with the received SDP answer
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: data.sdpAnswer })
        );

        console.log('✅ Remote description set successfully');
        break;
      case 'participantLeft':
        console.log(`🔴 Participant left: ${data.participantId}`);
        removeParticipant(data.participantId);
        break;
    }
  };
}





connectWebSocket();
