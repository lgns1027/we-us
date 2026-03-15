require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai'); // 나중에 정식 오픈 때 쓸 API

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// ★ 변경 1: 한 명만 기다리던 방식에서 -> 카테고리별 방으로 쪼갬
// 예: { "한국어_일상 대화": socket, "영어_상황극": socket }
const waitingQueues = {}; 
const roomVotes = {}; 

io.on('connection', (socket) => {
  console.log('🟢 접속:', socket.id);

  // ★ 변경 2: 프론트에서 보낸 언어와 주제 데이터를 받아서 매칭
  socket.on('join_queue', (data) => {
    // 아무것도 선택 안하고 왔을 경우의 기본값 방어 로직
    const lang = data?.lang || '한국어';
    const topic = data?.topic || '일상 대화';
    const queueKey = `${lang}_${topic}`; // 예: "영어_영화/문화"

    console.log(`🔎 유저 ${socket.id} 가 [${queueKey}] 대기열에 입장했습니다.`);

    // 1. 내가 고른 카테고리에 이미 누군가 기다리고 있다면? 매칭!
    if (waitingQueues[queueKey] && waitingQueues[queueKey].id !== socket.id) {
      const partnerSocket = waitingQueues[queueKey];
      const roomName = `room_${Date.now()}`;
      
      socket.join(roomName);
      partnerSocket.join(roomName);

      io.to(roomName).emit('matched', { roomName, hostId: socket.id });
      console.log(`🤝 [${queueKey}] 매칭 성사! 방 이름: ${roomName}`);

      delete waitingQueues[queueKey]; // 매칭됐으니 대기실에서 삭제
    } else {
      // 2. 대기자가 없으면 내가 이 카테고리의 첫 번째 대기자로 등록
      waitingQueues[queueKey] = socket;
      socket.queueKey = queueKey; // 나중에 도망갔을 때 지우기 위해 소켓에 꼬리표 달기
    }
  });

  socket.on('send_message', (data) => {
    socket.to(data.room).emit('receive_message', data);
  });

  socket.on('request_ai_help', (data) => {
    const dummyAiMessage = "정적이 흐르네요. 다들 영화관 가면 팝콘 파인가요, 나초 파인가요?";
    io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: dummyAiMessage });
  });

  socket.on('vote_extend', (data) => {
    const room = data.room;
    if (!roomVotes[room]) roomVotes[room] = new Set();
    roomVotes[room].add(socket.id);

    if (roomVotes[room].size === 2) {
      io.to(room).emit('time_extended', 120);
      roomVotes[room].clear();
    } else {
      socket.to(room).emit('partner_wants_extension');
    }
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('partner_left');
        delete roomVotes[room];
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 유저 이탈:', socket.id);
    // 대기 중에 도망갔다면 대기열에서 깔끔하게 삭제
    if (socket.queueKey && waitingQueues[socket.queueKey] === socket) {
      delete waitingQueues[socket.queueKey];
    }
  });
});

const PORT = process.env.PORT || 3001; 
server.listen(PORT, () => {
  console.log(`🚀 WE US 백엔드 구동 완료 (포트: ${PORT})`);
});