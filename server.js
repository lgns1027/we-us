require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: ["https://we-us-one.vercel.app", "https://we-us.online", "https://www.we-us.online", "http://localhost:3000"], 
    methods: ["GET", "POST"],
    credentials: true
  } 
});

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { "HTTP-Referer": "https://we-us.online", "X-Title": "WE US" }
});

const waitingQueues = {}; 
const roomVotes = {}; 
const activeRooms = {}; // ★ 통합: 싱글, 멀티 구분 없이 모든 방의 대화를 기억하는 저장소

io.on('connection', (socket) => {
  console.log('🟢 접속:', socket.id);

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

      // 멀티 방 데이터 생성
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
    
    // 싱글 방 데이터 생성
    activeRooms[roomId] = { type: 'single', lang: lang, history: [] };

    socket.emit('matched', { roomId: roomId, partner: `${lang} 봇` });
    
    const welcomeMsg = `안녕하세요! ${lang} 대화 연습 모드입니다. 편하게 말을 걸어주세요!`;
    socket.emit('receive_message', { sender: 'AI 🤖', text: welcomeMsg });
    activeRooms[roomId].history.push({ role: 'assistant', content: welcomeMsg });
  });

  // 3. 메시지 처리 및 저장
  socket.on('send_message', async (data) => {
    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    // 멀티 모드일 때
    if (roomData.type === 'multi') {
      roomData.history.push(`${data.sender === '나' ? 'User A' : 'User B'}: ${data.text}`);
      socket.to(data.room).emit('receive_message', data);
    } 
    // 싱글 모드일 때
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: data.text }); 

      try {
        const response = await openai.chat.completions.create({
          model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
          messages: [
            { role: 'system', content: `너는 사용자의 '${roomData.lang}' 대화 연습 파트너야. 반드시 '${roomData.lang}' 언어로만 대답하고 질문을 던져.` },
            ...roomData.history.slice(-8) 
          ],
          max_tokens: 150
        });

        const aiReply = response.choices[0].message.content.trim();
        roomData.history.push({ role: 'assistant', content: aiReply }); 
        socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
      } catch (error) {
        socket.emit('receive_message', { sender: 'System', text: 'AI 응답 지연 중...' });
      }
    }
  });

  // ★ 4. 대망의 [AI 케미 리포트 생성 로직]
  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData || roomData.type !== 'multi' || roomData.history.length < 4) {
      // 대화가 너무 적거나 싱글모드면 리포트 생략
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }

    try {
      console.log(`📊 방 ${data.room} 리포트 분석 시작...`);
      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
        messages: [
          { 
            role: 'system', 
            content: `너는 익명 채팅 분석가야. 아래 두 사람(User A, User B)의 대화를 읽고, 다음 양식에 맞춰 정확히 3줄로 한국어로 요약해.
            1. 티키타카 점수: (100점 만점 중 몇 점)
            2. 대화 키워드: (#해시태그 2개)
            3. AI 한줄평: (대화 흐름에 대한 재치있는 평가)` 
          },
          { role: 'user', content: roomData.history.join('\n') }
        ],
        max_tokens: 200
      });

      const report = response.choices[0].message.content.trim();
      io.to(data.room).emit('receive_report', { reportText: report });
    } catch (error) {
      console.error("리포트 에러:", error);
    }
  });

  // 5. 연장 투표
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

  // 6. 이탈 방지
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
    if (socket.queueKey && waitingQueues[socket.queueKey] === socket) {
      delete waitingQueues[socket.queueKey];
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 WE US 백엔드 구동 완료 (포트: ${PORT})`));