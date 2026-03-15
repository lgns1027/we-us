require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    // 가비아 도메인들도 VIP 명단에 추가했습니다.
    origin: ["https://we-us-one.vercel.app", "https://we-us.online", "https://www.we-us.online", "http://localhost:3000"], 
    methods: ["GET", "POST"],
    credentials: true
  } 
});

// OpenRouter AI 세팅 (무료 Gemini 사용)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { "HTTP-Referer": "https://we-us.online", "X-Title": "WE US" }
});

const waitingQueues = {}; 
const roomVotes = {}; 
const aiRooms = {}; // ★ 추가: 싱글 모드 방의 대화 기록과 언어 설정을 저장할 공간

io.on('connection', (socket) => {
  console.log('🟢 접속:', socket.id);

  // 1. [멀티 모드] 대기열 입장 및 매칭
  socket.on('join_queue', (data) => {
    const lang = data?.lang || '한국어';
    const topic = data?.topic || '일상 대화';
    const queueKey = `${lang}_${topic}`; 

    if (waitingQueues[queueKey] && waitingQueues[queueKey].id !== socket.id) {
      const partnerSocket = waitingQueues[queueKey];
      const roomName = `room_${Date.now()}`;
      
      socket.join(roomName);
      partnerSocket.join(roomName);

      io.to(roomName).emit('matched', { roomName, hostId: socket.id });
      delete waitingQueues[queueKey]; 
    } else {
      waitingQueues[queueKey] = socket;
      socket.queueKey = queueKey; 
    }
  });

  // 2. [싱글 모드] AI 방 생성 및 첫인사
  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    
    // 이 방은 AI 방임을 기록하고, 대화 맥락을 저장할 배열을 만듦
    aiRooms[roomId] = {
      lang: lang,
      history: [] 
    };

    socket.emit('matched', { roomId: roomId, partner: `${lang} 봇` });
    
    // AI의 첫인사
    const welcomeMsg = `안녕하세요! ${lang} 대화 연습 모드입니다. 편하게 말을 걸어주세요!`;
    socket.emit('receive_message', { sender: 'AI 🤖', text: welcomeMsg });
    aiRooms[roomId].history.push({ role: 'assistant', content: welcomeMsg });
  });

  // 3. 메시지 처리 (멀티 vs 싱글 분기)
  socket.on('send_message', async (data) => {
    // 3-1. 멀티 모드면 기존처럼 상대방에게 전달하고 끝
    if (!aiRooms[data.room]) {
      socket.to(data.room).emit('receive_message', data);
      return;
    }

    // 3-2. ★ 싱글 모드면 유저의 말을 저장하고 AI를 호출!
    const roomData = aiRooms[data.room];
    roomData.history.push({ role: 'user', content: data.text }); 

    try {
      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-lite-preview-02-05:free', // 가성비 최고의 무료 모델
        messages: [
          // 프롬프트: 선택한 언어에 맞춰서 대화해달라고 지시
          { role: 'system', content: `너는 사용자의 '${roomData.lang}' 대화 연습을 돕는 친절한 파트너야. 반드시 '${roomData.lang}' 언어로만 자연스럽게 대답하고, 질문을 던져서 대화를 이어가. 한 번에 너무 길게 말하지 마.` },
          ...roomData.history.slice(-8) // 대화 맥락 유지를 위해 최근 8개 대화만 기억력으로 던져줌
        ],
        max_tokens: 150
      });

      const aiReply = response.choices[0].message.content.trim();
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      
      // 답변을 유저 화면으로 쏴줌
      socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
    } catch (error) {
      console.error("AI API 에러:", error);
      socket.emit('receive_message', { sender: 'System', text: 'AI 연결이 잠시 지연되고 있습니다. 다시 말씀해 주시겠어요?' });
    }
  });

  // 4. [멀티 모드 전용] 10초 정적 브레이커
  socket.on('request_ai_help', async (data) => {
    try {
      const chatHistory = data.history.slice(-5).map(msg => ({
        role: msg.sender === '나' || msg.sender === '상대방' ? 'user' : 'assistant',
        content: `${msg.sender}: ${msg.text}`
      }));

      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
        messages: [
          { role: 'system', content: `너는 5분 익명 채팅방의 눈치빠른 진행자 AI야. 유저들이 10초간 말이 없어 어색한 상황이야. 이전 대화를 읽고, 흐름에 맞춰서 대화를 다시 이어갈 수 있는 가볍고 센스있는 질문을 한국어로 딱 1개만 던져. 절대 50자를 넘기지 마.` },
          ...chatHistory
        ],
        max_tokens: 100
      });

      const aiMessage = response.choices[0].message.content.trim();
      if (aiMessage && aiMessage.length > 0) {
        io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
      }
    } catch (error) {
      console.error("정적 브레이커 에러:", error);
    }
  });

  // 5. 2분 연장 투표 로직
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

  // 6. 이탈 방지 및 뒷정리
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('partner_left');
        delete roomVotes[room];
        delete aiRooms[room]; // 방 터지면 AI 기억력도 파기
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
server.listen(PORT, () => {
  console.log(`🚀 WE US 백엔드 구동 완료 (포트: ${PORT})`);
});