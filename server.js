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

// ★ 변경: 대기열을 배열로 관리하고, 타이머를 기록하는 객체 추가
const waitingQueues = {}; 
const matchTimers = {};
const roomVotes = {};     
const activeRooms = {};   

// ★ 대표님이 찾은 엔비디아/OpenAI 모델 + 최후의 자동 배차 시스템 적용
const AI_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free', // 1순위: 엔비디아
  'openai/gpt-oss-120b:free',               // 2순위: OpenAI OSS
  'meta-llama/llama-3.3-70b-instruct:free', // 3순위: 아까 바빴던 메타 70B
  'openrouter/free'                         // 4순위: 무적의 자동 배차 (아무나 걸려라)
];

async function fetchAIResponse(systemPrompt, history, maxTokens) {
  for (const model of AI_MODELS) {
    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        max_tokens: maxTokens
      });
      const content = response.choices[0]?.message?.content;
      if (content && content.trim()) return content.trim();
    } catch (error) {
      console.warn(`⚠️ [${model}] 응답 실패. 다음 모델로 전환.`);
      continue;
    }
  }
  throw new Error("모든 AI 모델 응답 불가");
}

// ★ 그룹 매칭 방 생성 함수
function startGroupRoom(queueKey) {
  const users = waitingQueues[queueKey].splice(0, 4); // 최대 4명 빼오기
  if (users.length < 2) {
    // 5초 기다리는 동안 누군가 나가서 1명만 남았다면 취소하고 다시 대기
    waitingQueues[queueKey] = [...users, ...waitingQueues[queueKey]];
    delete matchTimers[queueKey];
    return;
  }

  const roomName = `room_${Date.now()}`;
  activeRooms[roomName] = { type: 'multi', history: [], extensionCount: 0, participants: users.length };

  const aliases = ['익명 A', '익명 B', '익명 C', '익명 D'];
  
  users.forEach((u, index) => {
    u.join(roomName);
    u.userAlias = aliases[index]; // 각자 이름표 부여
    u.roomName = roomName;
  });

  io.to(roomName).emit('matched', { 
    roomName, 
    participantCount: users.length, 
    hostId: users[0].id 
  });

  delete matchTimers[queueKey];
}

io.on('connection', (socket) => {
  console.log(`🟢 접속됨: ${socket.id}`);

  // 1. [멀티 모드] 다중 매칭
  socket.on('join_queue', (data) => {
    const lang = data?.lang || '한국어';
    const topic = data?.topic || '일상 대화';
    const queueKey = `${lang}_${topic}`; 

    if (!waitingQueues[queueKey]) waitingQueues[queueKey] = [];
    
    if (!waitingQueues[queueKey].includes(socket)) {
      waitingQueues[queueKey].push(socket);
      socket.queueKey = queueKey;
    }

    // 4명이 꽉 차면 타이머 무시하고 즉시 시작
    if (waitingQueues[queueKey].length >= 4) {
      clearTimeout(matchTimers[queueKey]);
      startGroupRoom(queueKey);
    } 
    // 2명이 되었을 때 5초 타이머 시작 (추가 인원 모집)
    else if (waitingQueues[queueKey].length === 2 && !matchTimers[queueKey]) {
      matchTimers[queueKey] = setTimeout(() => {
        startGroupRoom(queueKey);
      }, 5000); // 5초 대기
    }
  });

  // 2. [싱글 모드]
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

  // 3. 메시지 라우터 (이름표 달아서 전송)
  socket.on('send_message', async (data) => {
    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    if (roomData.type === 'multi') {
      // 본인은 프론트에서 '나'로 찍히고, 서버 기록과 다른 사람에겐 '익명 A' 등으로 찍힘
      roomData.history.push(`${socket.userAlias}: ${data.text}`);
      socket.to(data.room).emit('receive_message', { sender: socket.userAlias, text: data.text });
    } 
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: data.text }); 
      try {
        const systemPrompt = `넌 사용자의 '${roomData.lang}' 대화 연습 파트너야. 친근하게 대답해.`;
        const aiReply = await fetchAIResponse(systemPrompt, roomData.history.slice(-8), 150);
        roomData.history.push({ role: 'assistant', content: aiReply }); 
        socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
      } catch (error) {
        socket.emit('receive_message', { sender: 'System', text: 'AI 연결 상태가 불안정합니다.' });
      }
    }
  });

  // 4. 10초 정적 브레이커
  socket.on('request_ai_help', async (data) => {
    try {
      const chatHistory = data.history.slice(-5).map(msg => ({
        role: msg.sender === '나' || msg.sender.includes('익명') ? 'user' : 'assistant',
        content: `${msg.sender}: ${msg.text}`
      }));
      const systemPrompt = `너는 익명 채팅방의 눈치빠른 진행자야. 10초간 말이 없어 어색한 상황이니 대화를 다시 이어갈 수 있는 질문을 딱 1개만 던져. 50자 제한.`;
      const aiMessage = await fetchAIResponse(systemPrompt, chatHistory, 100);
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    } catch (error) {
      console.error("🔥 [정적 브레이커 에러]:", error.message);
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
      const systemPrompt = `대화를 읽고 3줄로 요약해. 1. 그룹 티키타카 점수 2. 핵심 키워드(#해시태그 2개) 3. AI 한줄평`;
      const reportContent = await fetchAIResponse(systemPrompt, [{ role: 'user', content: roomData.history.join('\n') }], 250);
      io.to(data.room).emit('receive_report', { reportText: reportContent });
    } catch (error) {
      io.to(data.room).emit('receive_report', { error: true });
    }
  });

  // 6. 연장 투표 (참여 인원 전원 동의 시 연장)
  socket.on('vote_extend', (data) => {
    const room = data.room;
    const roomData = activeRooms[room];
    if (!roomData) return;

    if (!roomVotes[room]) roomVotes[room] = new Set();
    roomVotes[room].add(socket.id);

    // 방에 있는 인원수(participants)만큼 동의해야 연장됨
    if (roomVotes[room].size === roomData.participants) {
      roomData.extensionCount += 1;
      io.to(room).emit('time_extended', { addedTime: 120, currentExtensions: roomData.extensionCount });
      roomVotes[room].clear();
    } else {
      socket.to(room).emit('partner_wants_extension', { currentVotes: roomVotes[room].size, total: roomData.participants });
    }
  });

  // 7. 연결 해제 관리
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님이 퇴장하셨습니다.` });
        if (roomVotes[room]) roomVotes[room].delete(socket.id);
        
        const roomData = activeRooms[room];
        if (roomData) {
          roomData.participants -= 1;
          if (roomData.participants < 2) {
             socket.to(room).emit('partner_left');
             delete activeRooms[room];
          }
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 연결 끊김: ${socket.id}`);
    if (socket.queueKey && waitingQueues[socket.queueKey]) {
      waitingQueues[socket.queueKey] = waitingQueues[socket.queueKey].filter(s => s.id !== socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 WE US 백엔드 구동 완료 (포트: ${PORT})`));