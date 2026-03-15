require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

const waitingQueues = {}; 
const matchTimers = {};
const roomVotes = {};     
const activeRooms = {};   

// ★ 루프 삭제. OpenRouter 네이티브 폴백용 배열
const FALLBACK_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openrouter/free"
];

// ★ 직통망 API 함수: 0.1초만에 OpenRouter가 알아서 가장 빠른 모델로 연결함
async function fetchAIResponseFast(systemPrompt, history, maxTokens) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://we-us.online",
        "X-Title": "WE US"
      },
      body: JSON.stringify({
        models: FALLBACK_MODELS, // 배열로 넘기면 OpenRouter 내부에서 즉시 폴백 처리
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        max_tokens: maxTokens
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content && content.trim()) return content.trim();
    throw new Error("AI returned empty content");
  } catch (error) {
    console.error("🔥 AI 직통망 응답 실패:", error.message);
    throw error;
  }
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
      try {
        const systemPrompt = `넌 '${roomData.lang}' 대화 파트너야. 친근하게 대답해.`;
        const aiReply = await fetchAIResponseFast(systemPrompt, roomData.history.slice(-8), 200);
        roomData.history.push({ role: 'assistant', content: aiReply }); 
        socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
      } catch (error) {
        socket.emit('receive_message', { sender: 'System', text: '일시적인 통신 오류입니다. 다시 전송해주세요.' });
      }
    }
  });

  socket.on('request_ai_help', async (data) => {
    try {
      const chatHistory = data.history.slice(-5).map(msg => ({
        role: msg.sender === '나' || msg.sender.includes('익명') ? 'user' : 'assistant',
        content: `${msg.sender}: ${msg.text}`
      }));
      const systemPrompt = `익명 채팅방 진행자야. 10초간 정적이니 대화를 이을 질문 딱 1개만 던져. 50자 제한.`;
      const aiMessage = await fetchAIResponseFast(systemPrompt, chatHistory, 150);
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    } catch (error) {}
  });

  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData || roomData.type !== 'multi' || roomData.history.length < 4) {
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }
    try {
      const systemPrompt = `대화를 읽고 3줄 요약. 1. 그룹 티키타카 점수 2. 키워드(#해시태그 2개) 3. 한줄평`;
      const reportContent = await fetchAIResponseFast(systemPrompt, [{ role: 'user', content: roomData.history.join('\n') }], 250);
      io.to(data.room).emit('receive_report', { reportText: reportContent });
    } catch (error) {
      io.to(data.room).emit('receive_report', { error: true });
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

  // ★ 완벽한 메모리 누수 차단 (CORS 에러 방지)
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
          delete activeRooms[room]; // 싱글 모드 찌꺼기 완벽 삭제
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
server.listen(PORT, () => console.log(`🚀 WE US 백엔드 구동 완료 (포트: ${PORT})`));