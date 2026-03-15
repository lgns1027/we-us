require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');

const app = express();
const server = http.createServer(app);

// CORS 설정: 모든 접근 허용
const io = new Server(server, { 
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"]
  } 
});

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { "HTTP-Referer": "https://we-us.online", "X-Title": "WE US" }
});

const waitingQueues = {}; 
const roomVotes = {};     
const activeRooms = {};   

// ★ 가장 안정적인 OpenRouter 무료 모델로 교체
const AI_MODEL = 'openrouter/free';

io.on('connection', (socket) => {
  console.log(`🟢 접속됨: ${socket.id}`);

  // 1. [멀티 모드]
  socket.on('join_queue', (data) => {
    const lang = data?.lang || '한국어';
    const topic = data?.topic || '일상 대화';
    const queueKey = `${lang}_${topic}`; 

    if (waitingQueues[queueKey] && waitingQueues[queueKey].id !== socket.id) {
      const partnerSocket = waitingQueues[queueKey];
      const roomName = `room_${Date.now()}`;
      
      socket.join(roomName);
      partnerSocket.join(roomName);

      activeRooms[roomName] = { type: 'multi', history: [] };
      io.to(roomName).emit('matched', { roomName, hostId: socket.id });
      delete waitingQueues[queueKey]; 
    } else {
      waitingQueues[queueKey] = socket;
      socket.queueKey = queueKey; 
    }
  });

  // 2. [싱글 모드]
  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    
    activeRooms[roomId] = { type: 'single', lang: lang, history: [] };
    socket.emit('matched', { roomId: roomId, partner: `${lang} 봇` });
    
    const welcomeMsg = `안녕하세요! ${lang} 대화 연습 모드입니다. 편하게 말을 걸어주세요!`;
    socket.emit('receive_message', { sender: 'AI 🤖', text: welcomeMsg });
    activeRooms[roomId].history.push({ role: 'assistant', content: welcomeMsg });
  });

  // 3. 메시지 라우터 (채팅 전송)
  socket.on('send_message', async (data) => {
    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    if (roomData.type === 'multi') {
      roomData.history.push(`${data.sender === '나' ? 'User A' : 'User B'}: ${data.text}`);
      socket.to(data.room).emit('receive_message', data);
    } 
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: data.text }); 
      try {
        const response = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: `넌 사용자의 '${roomData.lang}' 대화 연습 파트너야. '${roomData.lang}'로만 답해.` },
            ...roomData.history.slice(-8) 
          ],
          max_tokens: 150
        });
        const aiReply = response.choices[0].message.content.trim();
        roomData.history.push({ role: 'assistant', content: aiReply }); 
        socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
      } catch (error) {
        // ★ 에러 상세 로그 출력
        console.error("🔥 [싱글모드] AI 응답 에러 상세:", error.message || error);
        socket.emit('receive_message', { sender: 'System', text: 'AI 연결 상태가 불안정합니다. (Render 로그 확인 요망)' });
      }
    }
  });

  // 4. 10초 정적 브레이커
  socket.on('request_ai_help', async (data) => {
    try {
      const chatHistory = data.history.slice(-5).map(msg => ({
        role: msg.sender === '나' || msg.sender === '상대방' ? 'user' : 'assistant',
        content: `${msg.sender}: ${msg.text}`
      }));

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: `너는 익명 채팅방의 진행자야. 유저들이 10초간 말이 없어 어색한 상황이니 대화를 이어갈 수 있는 가볍고 센스있는 질문을 딱 1개만 던져. 절대 50자를 넘기지 마.` },
          ...chatHistory
        ],
        max_tokens: 100
      });

      const aiMessage = response.choices[0].message.content.trim();
      if (aiMessage) {
        io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
      }
    } catch (error) {
      console.error("🔥 [정적 브레이커] 에러 상세:", error.message || error);
    }
  });

  // 5. AI 케미 리포트 발급
  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData || roomData.type !== 'multi' || roomData.history.length < 4) {
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { 
            role: 'system', 
            content: `두 사람의 대화를 읽고 3줄로 요약해. 1. 티키타카 점수 2. 키워드(#해시태그) 3. AI 한줄평` 
          },
          { role: 'user', content: roomData.history.join('\n') }
        ],
        max_tokens: 200
      });
      io.to(data.room).emit('receive_report', { reportText: response.choices[0].message.content.trim() });
    } catch (error) {
      console.error("🔥 [케미 리포트] 에러 상세:", error.message || error);
      io.to(data.room).emit('receive_report', { error: true });
    }
  });

  // 6. 2분 연장 투표
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

  // 7. 이탈 방지 및 데이터 정리
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('partner_left');
        delete roomVotes[room];
        delete activeRooms[room]; 
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 연결 끊김: ${socket.id}`);
    if (socket.queueKey && waitingQueues[socket.queueKey] === socket) {
      delete waitingQueues[socket.queueKey];
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 WE US 백엔드 구동 완료 (포트: ${PORT})`);
});