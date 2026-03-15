require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

// ★ 구글 공식 SDK 연결
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const waitingQueues = {}; 
const matchTimers = {};
const roomVotes = {};     
const activeRooms = {};   

// ★ 구글 본섭 직결: Gemma 릴레이 + 최후의 보루(Gemini)
// server.js 내 수정 부분
async function getGoogleAIResponse(systemPrompt, history) {
  const modelsToTry = [
    "gemma-3-27b-it", // 1순위: 가장 똑똑한 27B
    "gemma-3-12b-it", // 2순위: 균형 잡힌 12B
    "gemma-3-4b-it",  // 3순위: 가벼운 4B
    "gemini-2.0-flash" // 최후의 보루: 젬마 시리즈가 다 뻗을 때를 대비한 구글 메인 모델
  ];

  // ... 이하 동일

  // 대화 기록을 구글 SDK가 이해하는 형식으로 변환
  const contents = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
      });
      
      const result = await model.generateContent({ contents });
      const responseText = result.response.text();
      
      if (responseText && responseText.trim()) {
        return responseText.trim();
      }
    } catch (error) {
      console.log(`[${modelName}] 실패 (다음 모델 시도) - 사유: ${error.message}`);
    }
  }
  return "AI 서버에 일시적인 트래픽이 몰렸습니다. 다른 말을 걸어주시겠어요?";
}

function startGroupRoom(queueKey) {
  const users = waitingQueues[queueKey].splice(0, 4); 
  if (users.length < 2) {
    waitingQueues[queueKey] = [...users, ...waitingQueues[queueKey]];
    delete matchTimers[queueKey];
    return;
  }

  const roomName = `room_${Date.now()}`;
  activeRooms[roomName] = { type: 'multi', history: [], extensionCount: 0, participants: users.length };

  const aliases = ['익명 A', '익명 B', '익명 C', '익명 D'];
  users.forEach((u, index) => {
    u.join(roomName);
    u.userAlias = aliases[index]; 
    u.roomName = roomName;
  });

  io.to(roomName).emit('matched', { roomName, participantCount: users.length, hostId: users[0].id });
  delete matchTimers[queueKey];
}

io.on('connection', (socket) => {
  socket.on('join_queue', (data) => {
    const lang = data?.lang || '한국어';
    const topic = data?.topic || '일상 대화';
    const queueKey = `${lang}_${topic}`; 

    if (!waitingQueues[queueKey]) waitingQueues[queueKey] = [];
    if (!waitingQueues[queueKey].includes(socket)) {
      waitingQueues[queueKey].push(socket);
      socket.queueKey = queueKey;
    }

    if (waitingQueues[queueKey].length >= 4) {
      clearTimeout(matchTimers[queueKey]);
      startGroupRoom(queueKey);
    } else if (waitingQueues[queueKey].length === 2 && !matchTimers[queueKey]) {
      matchTimers[queueKey] = setTimeout(() => startGroupRoom(queueKey), 5000);
    }
  });

  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    socket.userAlias = '나';
    
    activeRooms[roomId] = { type: 'single', lang: lang, history: [] };
    socket.emit('matched', { roomId: roomId, partner: `${lang} 봇`, participantCount: 2 });
    
    const welcomeMsg = `안녕하세요! ${lang} 대화 연습 모드입니다. 편하게 말을 걸어주세요!`;
    socket.emit('receive_message', { sender: 'AI 🤖', text: welcomeMsg });
    activeRooms[roomId].history.push({ role: 'assistant', content: welcomeMsg });
  });

  socket.on('send_message', async (data) => {
    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    if (roomData.type === 'multi') {
      roomData.history.push(`${socket.userAlias}: ${data.text}`);
      socket.to(data.room).emit('receive_message', { sender: socket.userAlias, text: data.text });
    } 
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: data.text }); 
      
      const systemPrompt = `넌 '${roomData.lang}' 대화 파트너야. 친절하게 대답해.`;
      const aiReply = await getGoogleAIResponse(systemPrompt, roomData.history.slice(-8));
      
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
    }
  });

  socket.on('request_ai_help', async (data) => {
    const chatHistory = data.history.slice(-5).map(msg => ({
      role: msg.sender === '나' || msg.sender.includes('익명') ? 'user' : 'assistant',
      content: `${msg.sender}: ${msg.text}`
    }));
    const systemPrompt = `익명 채팅방 진행자야. 10초간 정적이니 대화를 이을 질문 딱 1개만 던져. 50자 제한.`;
    const aiMessage = await getGoogleAIResponse(systemPrompt, chatHistory);
    
    if (!aiMessage.includes("트래픽이 몰렸습니다")) {
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    }
  });

  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData || roomData.type !== 'multi' || roomData.history.length < 4) {
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }
    const systemPrompt = `대화를 읽고 3줄 요약. 1. 그룹 티키타카 점수 2. 키워드(#해시태그 2개) 3. 한줄평`;
    const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: roomData.history.join('\n') }]);
    
    if (reportContent.includes("트래픽이 몰렸습니다")) {
      io.to(data.room).emit('receive_report', { error: true });
    } else {
      io.to(data.room).emit('receive_report', { reportText: reportContent });
    }
  });

  socket.on('vote_extend', (data) => {
    const room = data.room;
    const roomData = activeRooms[room];
    if (!roomData) return;

    if (!roomVotes[room]) roomVotes[room] = new Set();
    roomVotes[room].add(socket.id);

    if (roomVotes[room].size === roomData.participants) {
      roomData.extensionCount += 1;
      io.to(room).emit('time_extended', { addedTime: 120, currentExtensions: roomData.extensionCount });
      roomVotes[room].clear();
    } else {
      socket.to(room).emit('partner_wants_extension', { currentVotes: roomVotes[room].size, total: roomData.participants });
    }
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        const roomData = activeRooms[room];
        if (!roomData) continue;

        if (roomData.type === 'multi') {
          socket.to(room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님이 퇴장하셨습니다.` });
          if (roomVotes[room]) roomVotes[room].delete(socket.id);
          
          roomData.participants -= 1;
          if (roomData.participants < 2) {
             socket.to(room).emit('partner_left');
             delete activeRooms[room];
             delete roomVotes[room];
          }
        } else if (roomData.type === 'single') {
          delete activeRooms[room]; 
        }
      }
    }
  });

  socket.on('disconnect', () => {
    if (socket.queueKey && waitingQueues[socket.queueKey]) {
      waitingQueues[socket.queueKey] = waitingQueues[socket.queueKey].filter(s => s.id !== socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 WE US 구동 완료 (포트: ${PORT})`));