require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { "HTTP-Referer": "https://we-us.online", "X-Title": "WE US" }
});

const waitingQueues = {}; 
const roomVotes = {};     
const activeRooms = {};   

// ★ 에이스 알바생 3명 대기열 (1순위가 바쁘면 2, 3순위가 즉각 대타 출동)
const AI_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'google/gemma-3-27b-it:free'
];

// ★ 핵심 플랜 B 엔진: 모델이 터지면 다음 모델로 자동 재시도하는 함수
async function fetchAIResponse(systemPrompt, history, maxTokens) {
  for (const model of AI_MODELS) {
    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history
        ],
        max_tokens: maxTokens
      });
      const content = response.choices[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim(); // 성공하면 즉시 답변 반환
      }
    } catch (error) {
      console.warn(`⚠️ [${model}] 응답 실패. 다음 모델로 전환합니다. (사유: ${error.message})`);
      continue; // 에러(429 등) 나면 멈추지 않고 다음 모델로 넘어감
    }
  }
  // 3명이 전부 다 바빠서 터졌을 때의 최후 방어선
  throw new Error("모든 AI 모델이 현재 응답할 수 없습니다.");
}

io.on('connection', (socket) => {
  console.log(`🟢 접속됨: ${socket.id}`);

  // 1. [멀티 모드] 매칭
  socket.on('join_queue', (data) => {
    const lang = data?.lang || '한국어';
    const topic = data?.topic || '일상 대화';
    const queueKey = `${lang}_${topic}`; 

    if (waitingQueues[queueKey] && waitingQueues[queueKey].id !== socket.id) {
      const partnerSocket = waitingQueues[queueKey];
      const roomName = `room_${Date.now()}`;
      
      socket.join(roomName);
      partnerSocket.join(roomName);

      activeRooms[roomName] = { type: 'multi', history: [], extensionCount: 0 };
      io.to(roomName).emit('matched', { roomName, hostId: socket.id });
      delete waitingQueues[queueKey]; 
    } else {
      waitingQueues[queueKey] = socket;
      socket.queueKey = queueKey; 
    }
  });

  // 2. [싱글 모드] AI 방 생성
  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    
    activeRooms[roomId] = { type: 'single', lang: lang, history: [] };
    socket.emit('matched', { roomId: roomId, partner: `${lang} 봇` });
    
    const welcomeMsg = `안녕하세요! ${lang} 대화 연습 모드입니다. 편하게 말을 걸어주세요!`;
    socket.emit('receive_message', { sender: 'AI 🤖', text: welcomeMsg });
    activeRooms[roomId].history.push({ role: 'assistant', content: welcomeMsg });
  });

  // 3. 메시지 송수신 및 AI 답변
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
        const systemPrompt = `넌 사용자의 '${roomData.lang}' 대화 연습 파트너야. 반드시 '${roomData.lang}' 언어로만 친근하게 대답해.`;
        // ★ 릴레이 엔진 호출
        const aiReply = await fetchAIResponse(systemPrompt, roomData.history.slice(-8), 150);
        
        roomData.history.push({ role: 'assistant', content: aiReply }); 
        socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
      } catch (error) {
        console.error("🔥 [싱글모드 완전 실패]:", error.message);
        socket.emit('receive_message', { sender: 'System', text: '현재 접속자가 너무 많아 AI가 답변을 놓쳤습니다. 다시 말씀해주시겠어요?' });
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

      const systemPrompt = `너는 익명 채팅방의 눈치빠른 진행자야. 10초간 말이 없어 어색한 상황이니 대화를 다시 이어갈 수 있는 가볍고 센스있는 질문을 한국어로 딱 1개만 던져. 50자 제한.`;
      
      const aiMessage = await fetchAIResponse(systemPrompt, chatHistory, 100);
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    } catch (error) {
      console.error("🔥 [정적 브레이커 완전 실패]:", error.message);
    }
  });

  // 5. AI 케미 리포트
  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData || roomData.type !== 'multi' || roomData.history.length < 4) {
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }

    try {
      const systemPrompt = `두 사람의 대화를 읽고 정확히 3줄로 요약해. 
      1. 티키타카 점수: (100점 만점) 
      2. 핵심 키워드: (#해시태그 2개) 
      3. AI 한줄평: (대화 흐름 평가)`;
      
      const reportContent = await fetchAIResponse(systemPrompt, [{ role: 'user', content: roomData.history.join('\n') }], 250);
      io.to(data.room).emit('receive_report', { reportText: reportContent });
    } catch (error) {
      console.error("🔥 [케미 리포트 완전 실패]:", error.message);
      io.to(data.room).emit('receive_report', { error: true });
    }
  });

  // 6. 연장 투표 (2회 제한 포함)
  socket.on('vote_extend', (data) => {
    const room = data.room;
    const roomData = activeRooms[room];
    if (!roomData) return;

    if (!roomVotes[room]) roomVotes[room] = new Set();
    roomVotes[room].add(socket.id);

    if (roomVotes[room].size === 2) {
      roomData.extensionCount += 1;
      io.to(room).emit('time_extended', { addedTime: 120, currentExtensions: roomData.extensionCount });
      roomVotes[room].clear();
    } else {
      socket.to(room).emit('partner_wants_extension');
    }
  });

  // 7. 연결 해제 관리
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