db.collection('testing').get().then((snapshot)=>{
    snapshot.docs.forEach(doc => {
        console.log(doc.data())
    });
})


startcam=document.getElementById("startcam");
mycam=document.getElementById("mycam");
pertnercam=document.getElementById("partnercam");
call=document.getElementById("call");
calldetails=document.getElementById("calldetails");
mute=document.getElementById("mute");
answer=document.getElementById("answer");
hangup=document.getElementById("hangup");
let mydevice=null;
let partnerdevice=null;


const servers = {
    iceServers: [
        {
            urls:['stun:stun.l.google.com:19302',   
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'],
        },
    ],
};
const peerConnection = new RTCPeerConnection(servers);

startcam.onclick = async () => {
    mydevice = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    partnerdevice = new MediaStream();

    // Push tracks from local stream to peer connection
    mydevice.getTracks().forEach((track) => {

      peerConnection.addTrack(track, mydevice);
    });
  
    // Pull tracks from remote stream, add to video stream
    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        partnerdevice.addTrack(track);
      });
    };

  
    mycam.srcObject = mydevice;
    mycam.muted=true;
    partnercam.srcObject = partnerdevice;
    call.disabled = false;
  answer.disabled = false;
  hangup.disabled = true;
};

// 2. Create an offer
call.onclick = async () => {
    // Reference Firestore collections for signaling
    const callDoc = db.collection('calldetails').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');
  
    calldetails.value = callDoc.id;
   
    // Get candidates for caller, save to db
    peerConnection.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };
  
    // Create offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
  
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
  
    await callDoc.set({ offer });
  
    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.setRemoteDescription(answerDescription);
      }
    });
  
    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
    mute.disabled=false;
    hangup.disabled = false;
  };    
  
  // 3. Answer the call with the unique ID
 answer.onclick = async () => {
    const callId = calldetails.value;
    const callDoc = db.collection('calldetails').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');
  
    peerConnection.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };
  
    const callData = (await callDoc.get()).data();
  
    const offerDescription = callData.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));
  
    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);
  
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };
  
    await callDoc.update({ answer });
  
    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        console.log(change);
        if (change.type === 'added') {
          let data = change.doc.data();
          peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    mute.disabled=false;
    hangup.disabled = false;
  };
  //Funtion to mute audio
  mute.onclick = function(){
    mydevice.getAudioTracks()[0].enabled=!mydevice.getAudioTracks()[0].enabled;
   
  }
  //Funtion to hang up the call
hangup.onclick=function(){
  document.location.reload();
}

