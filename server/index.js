import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import kurento from 'kurento-client';
import path from 'path';

const app = express();
const server = http.createServer(app);
const __dirname = path.resolve();

console.log('ffffffffffffff',__dirname, path.join(__dirname, 'public', 'index.html'));
// ✅ Serve static files (including index.html)
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname,  'public', 'index.html'));
});


const wss = new WebSocketServer({ server });

//const KURENTO_URL = 'ws://localhost:8888';
const KURENTO_URL      = 'ws://host.docker.internal:8888/kurento'
const waitingRoom = new Set();
const breakoutRooms = {};
const participants = {};

let kurentoClient = null;
let pipeline = null;
let recorder = null;

const getKurentoClient = (callback) => {
  console.log('getKurentoClient============');
  if (kurentoClient) return callback(null, kurentoClient);

  kurento(KURENTO_URL, (error, _kurentoClient) => {
    console.log('getKurentoClient', _kurentoClient);
    if (error){
      console.log('rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', error);
      return callback(error);
    } 
    kurentoClient = _kurentoClient;
    callback(null, kurentoClient);
  });
};

const createPipeline = (callback) => {
  getKurentoClient((error, kurentoClient) => {
    if (error) return callback(error);

    kurentoClient.create('MediaPipeline', (error, _pipeline) => {
      if (error) return callback(error);

      pipeline = _pipeline;
      setupRecorder();
      callback(null, pipeline);
    });
  });
};

const setupRecorder = () => {
  pipeline.create(
    'RecorderEndpoint',
    { uri: 'file:///tmp/recording.webm' },
    (error, _recorder) => {
      if (error) return console.error('Error creating RecorderEndpoint:', error);

      recorder = _recorder;
      console.log('Recorder ready at /tmp/recording.webm');
    }
  );
};

// const addParticipant = (ws, sdpOffer, name) => {
//   if (!pipeline) {
//     return createPipeline(() => addParticipant(ws, sdpOffer, name));
//   }

//   pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
//     if (error) return console.error('Error creating WebRtcEndpoint:', error);

//     participants[ws.id] = { name, webRtcEndpoint };

//     // webRtcEndpoint.on('OnIceCandidate', (event) => {
//     //   const candidate = kurento.getComplexType('IceCandidate')(event.candidate);
//     //   ws.send(JSON.stringify({ id: 'iceCandidate', candidate }));
//     // });

//     webRtcEndpoint.on('IceCandidateFound', (event) => {
//       const candidate = kurento.getComplexType('IceCandidate')(event.candidate);
//       ws.send(JSON.stringify({ id: 'iceCandidate', candidate }));
//     });

//     webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
//       if (error) return console.error('Error processing offer:', error);

//       ws.send(JSON.stringify({ id: 'sdpAnswer', sdpAnswer }));
//       webRtcEndpoint.gatherCandidates();

//       if (recorder) {
//         webRtcEndpoint.connect(recorder, (error) => {
//           if (error) console.error('Error connecting to recorder:', error);
//         });
//       }
//     });
//   });
// };


const addParticipant = (ws, sdpOffer, name) => {
  if (!pipeline) {
    console.log('Pipeline not initialized. Creating pipeline...');
    return createPipeline(() => addParticipant(ws, sdpOffer, name));
  }

  pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
    if (error) {
      console.error('Error creating WebRtcEndpoint:', error);
      return;
    }

    participants[ws.id] = { name, webRtcEndpoint };

    // ✅ Handle incoming ICE candidates from the client
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      if (data.id === 'iceCandidate') {
        const candidate = kurento.getComplexType('IceCandidate')(data.candidate);
        console.log('Adding ICE candidate from client:', candidate);
        isWebRtcEndpointAlive(webRtcEndpoint) && webRtcEndpoint.addIceCandidate(candidate);
        console.log('55555555555555555555555555555555555555555555555555555555555555555555');
      }
    });

    // ✅ Handle outgoing ICE candidates from Kurento
    console.log('2222222222222222222222222222222222222222');
    isWebRtcEndpointAlive(webRtcEndpoint) && webRtcEndpoint.on('IceCandidateFound', (event) => {
      const candidate = kurento.getComplexType('IceCandidate')(event.candidate);
      console.log('Sending ICE candidate to client:', candidate);
      ws.send(JSON.stringify({ id: 'iceCandidate', candidate }));
    });
    console.log('2222222222222222222222222222222222222222');
    // ✅ Process SDP offer and generate SDP answer
    if (typeof sdpOffer !== 'string') {
      console.error('Invalid SDP offer:', sdpOffer);
      return;
    }
    console.log('111111111111111111111111111111111');
    isWebRtcEndpointAlive(webRtcEndpoint) && webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
      if (error) {
        console.error('Error processing offer:', error);
        return;
      }

      console.log('✅ SDP Answer generated:', sdpAnswer);

      // ✅ Send SDP answer to client
      ws.send(JSON.stringify({ id: 'sdpAnswer', sdpAnswer }));
      console.log('6666666666666666666666666666666666');
      // ✅ Start gathering ICE candidates
      isWebRtcEndpointAlive(webRtcEndpoint) && webRtcEndpoint.gatherCandidates();
      console.log('9999999999999999999999999999999999999999999');
      // ✅ Connect to recorder (if recording is enabled)
      if (recorder) {
        console.log('8888888888888888888888888888888888888888888');
        isWebRtcEndpointAlive(webRtcEndpoint) && webRtcEndpoint.connect(recorder, (error) => {
          if (error) {
            console.error('Error connecting to recorder:', error);
          } else {
            console.log('✅ WebRtcEndpoint connected to recorder');
          }
        });
        console.log('677777777777777777777767777777777777777777777777767676767676667');
      }
    });
  });
};



const broadcastMessage = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

const handleScreenSharingRequest = (ws, from) => {
  if (from === ws.id) {
    ws.send(JSON.stringify({ id: 'screenSharePermission', granted: true }));
  } else {
    broadcastMessage({ id: 'screenShareRequest', from });
  }
};

const handleWaitingRoomApproval = (id) => {
  if (waitingRoom.has(id)) {
    waitingRoom.delete(id);
    broadcastMessage({ id: 'participantApproved', id });
  }
};

const handleEmoji = (ws, emoji) => {
  broadcastMessage({ id: 'emoji', from: ws.id, emoji });
};

const joinBreakoutRoom = (ws, room) => {
  console.log('hhhhhhhhhhhhhhhhhhhhhhhhh', ws.id, room);
  breakoutRooms[room] = breakoutRooms[room] || new Set();
  breakoutRooms[room].add(ws.id);
};

const leaveBreakoutRoom = (ws, room) => {
  breakoutRooms[room]?.delete(ws.id);
};

//console.log('sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss', wss);
wss.on('connection', (ws) => {
  //console.log('gggggggggggggggggggggggggggggggggggggggggggg=================', ws);
  ws.id = Math.random().toString(36).substr(2, 9);

  ws.on('message', (message) => {
    console.log('==============================================', message);
    const data = JSON.parse(message);

    switch (data.id) {
      case 'start':
        console.log(`Participant ${ws.id} (${data.name}) is requesting to join.`);
        // ✅ Only add to the waiting room AFTER clicking Start!
        waitingRoom.add(ws.id);
        addParticipant(ws, data.sdpOffer, data.name);
        break;
      case 'chat':
        broadcastMessage({ id: 'chatMessage', from: data.from, message: data.message });
        break;
      case 'emoji':
        handleEmoji(ws, data.emoji);
        break;
      case 'screenShareRequest':
        handleScreenSharingRequest(ws, data.from);
        break;
      case 'waitingRoomApproval':
        handleWaitingRoomApproval(data.id);
        break;
      case 'joinBreakoutRoom':
        joinBreakoutRoom(ws, data.room);
        break;
      case 'leaveBreakoutRoom':
        leaveBreakoutRoom(ws, data.room);
        break;
      case 'stop':
        // if (participants[ws.id]) {
        //   participants[ws.id].webRtcEndpoint.release();
        //   delete participants[ws.id];
        // }
        stopCall(ws);
        break;
    }
  });
});


function stopCall(ws) {
  const userId = ws.id;
  console.log(`Stopping call for user: ${ws.id}`);

  if (participants[userId]) {
      console.log(`Releasing WebRtcEndpoint for user: ${userId}`);
      
      // Ensure endpoint still exists before releasing
      if (participants[userId] && participants[userId].webRtcEndpoint.release) {
        participants[userId].webRtcEndpoint.release(err => {
              if (err) {
                  console.error(`Error releasing WebRtcEndpoint for user ${userId}:`, err);
              } else {
                  console.log(`WebRtcEndpoint released for user ${userId}`);
              }
              delete participants[userId];
          });
      } else {
          console.warn(`WebRtcEndpoint for user ${userId} not found or already released`);
      }
  }

  // Only release mediaPipeline if no users are left
  if (Object.keys(participants).length === 0 && pipeline) {
      console.log('No more users in call. Releasing MediaPipeline...');
      
      if (pipeline && pipeline.release) {
        pipeline.release(err => {
              if (err) {
                  console.error('Error releasing MediaPipeline:', err);
              } else {
                  console.log('MediaPipeline released');
              }
              pipeline = null;
          });
      } else {
          console.warn('MediaPipeline already released or not found');
      }
  }

  ws.send(JSON.stringify({ id: 'participantLeft', participantId: userId }));
}



wss.on('disconnect', (ws) => {
  stopCall(ws.id);
});



function isWebRtcEndpointAlive(endpoint) {
  if (!endpoint) return false;
  try {
      if(endpoint && typeof endpoint.getId === 'function') {
      const id = endpoint.getId();
      console.log(`WebRtcEndpoint ID: ${id}`);
      return true;
      }
      return false;
  } catch (err) {
      console.error('WebRtcEndpoint is not alive:', err);
      return false;
  }
}


// function stopCall(userId) {
//   console.log(`Stopping call for user: ${userId}`);
  
//   if (webRtcEndpoints[userId]) {
//       webRtcEndpoints[userId].release(err => {
//           if (err) {
//               console.error(`Error releasing WebRtcEndpoint for user ${userId}:`, err);
//           } else {
//               console.log(`WebRtcEndpoint released for user ${userId}`);
//           }
//           delete webRtcEndpoints[userId];
//       });
//   }

//   // Release mediaPipeline only if no users are left
//   if (Object.keys(webRtcEndpoints).length === 0 && mediaPipeline) {
//       console.log('No more users in call. Releasing MediaPipeline...');
//       mediaPipeline.release(err => {
//           if (err) {
//               console.error('Error releasing MediaPipeline:', err);
//           } else {
//               console.log('MediaPipeline released');
//           }
//           mediaPipeline = null;
//       });
//   }
// }


server.listen(3000, () => console.log('Server running on http://localhost:3000'));
