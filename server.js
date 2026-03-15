require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

// --- [1. 데이터베이스 연결 및 스키마 세팅] ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🍃 MongoDB 연결 성공! 대화 기록이 영구 저장됩니다."))
  .catch(err => console.error("❌ DB 연결 실패:", err));

const ReportSchema = new mongoose.Schema({
  roomName: String,
  type: String, 
  lang: String,
  topic: String,
  participants: Number,
  fullLog: [String],
  aiReport: String,
  createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', ReportSchema);

// --- [2. 상태 관리 변수] ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const waitingQueues = {}; 
const matchTimers = {};
const roomVotes = {};     
const activeRooms = {};   

// --- [3. AI 통신 엔진 (Gemma 우회 적용)] ---
async function getGoogleAIResponse(systemPrompt, history, maxTokens = 150) {
  const modelsToTry = [
    "gemma-3-12b-it", // 속도와 성능 밸런스 1순위
    "gemma-3-27b-it",
    "gemma-3-4b-it"
  ];

  const contents = history.map((msg, index) => {
    let text = msg.content;
    if (index === 0 && msg.role !== 'assistant') {
      text = `[시스템 지시사항: ${systemPrompt}]\n\n사용자 메시지: ` + text;
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: text }]
    };
  });

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { maxOutputTokens: maxTokens } 
      });
      const result = await model.generateContent({ contents });
      const responseText = result.response.text();
      
      if (responseText && responseText.trim()) {
        return responseText.trim();
      }
    } catch (error) {
      console.log(`[${modelName}] 실패 - 사유: ${error.message}`);
    }
  }
  return "AI 연결에 실패했습니다. 다른 말을 걸어주시겠어요?";
}

// --- [4. 매칭 및 방 생성 로직] ---
function startGroupRoom(queueKey) {
  const users = waitingQueues[queueKey].splice(0, 4); 
  if (users.length < 2) {
    waitingQueues[queueKey] = [...users, ...waitingQueues[queueKey]];
    delete matchTimers[queueKey];
    return;
  }

  const roomName = `room_${Date.now()}`;
  activeRooms[roomName] = { 
    type: 'multi', 
    history: [], 
    extensionCount: 0, 
    participants: users.length, 
    isGeneratingReport: false, // 1초 싱크 오류 방지 락
    lang: queueKey.split('_')[0],
    topic: queueKey.split('_')[1]
  };

  const aliases = ['익명 A', '익명 B', '익명 C', '익명 D'];
  users.forEach((u, index) => {
    u.join(roomName);
    u.userAlias = aliases[index]; 
    u.roomName = roomName;
  });

  io.to(roomName).emit('matched', { roomName, participantCount: users.length, hostId: users[0].id });
  delete matchTimers[queueKey];
}

// --- [5. 소켓 통신 메인 로직] ---
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
      matchTimers[queueKey] = setTimeout(() => startGroupRoom(queueKey), 3000); // 3초 대기
    }
  });

  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    socket.userAlias = '나';
    
    activeRooms[roomId] = { type: 'single', lang: lang, topic: 'AI 연습', history: [], isGeneratingReport: false };
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
      const aiReply = await getGoogleAIResponse(systemPrompt, roomData.history.slice(-8), 150);
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
    }
  });

  socket.on('request_ai_help', async (data) => {
    const chatHistory = data.history.slice(-5).map(msg => ({
      role: msg.sender === '나' || msg.sender.includes('익명') ? 'user' : 'assistant',
      content: `${msg.sender}: ${msg.text}`
    }));
    const systemPrompt = `너는 대화방의 'AI 진행자'야. 대화 참여자를 연기하지 마. 10초간 정적이 흘렀으니 짧은 질문 하나만 던져. 50자 이내.`;
    const aiMessage = await getGoogleAIResponse(systemPrompt, chatHistory, 100);
    
    if (!aiMessage.includes("실패했습니다")) {
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    }
  });

  // ★ AI 리포트 생성 및 MongoDB 저장
  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    
    if (!roomData || roomData.history.length < 4) {
      if(roomData && roomData.isGeneratingReport) return;
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }

    if (roomData.isGeneratingReport) return; 
    roomData.isGeneratingReport = true; 

    let systemPrompt = "";
    let conversationText = "";

    if (roomData.type === 'single') {
      systemPrompt = `이 대화는 사용자가 AI와 진행한 대화 연습이야. 대화를 평가해서 3줄로 요약해. 1. 대화 주도력 점수: (100점 만점) 2. 핵심 키워드: (#해시태그 2개) 3. 피드백: (칭찬이나 조언 한줄평)`;
      conversationText = roomData.history.map(msg => `${msg.role === 'user' ? '나' : 'AI'}: ${msg.content}`).join('\n');
    } else {
      systemPrompt = `대화를 읽고 3줄 요약해. 1. 그룹 티키타카 점수: (100점 만점) 2. 핵심 키워드: (#해시태그 2개) 3. 한줄평`;
      conversationText = roomData.history.join('\n');
    }

    const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: conversationText }], 200);
    
    // DB 저장 (백그라운드 비동기 처리)
    try {
      if (!reportContent.includes("실패했습니다")) {
        await Report.create({
          roomName: data.room,
          type: roomData.type,
          lang: roomData.lang || '알 수 없음',
          topic: roomData.topic || '알 수 없음',
          participants: roomData.participants || 2,
          fullLog: roomData.type === 'single' ? roomData.history.map(m => m.content) : roomData.history,
          aiReport: reportContent
        });
        console.log(`✅ ${data.room} 리포트 DB 저장 완료!`);
      }
    } catch (dbError) {
      console.error("🔥 DB 저장 실패:", dbError);
    }

    if (reportContent.includes("실패했습니다")) {
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

  socket.on('leave_room', (data) => {
    const room = data.room;
    const roomData = activeRooms[room];
    if (!roomData) return;

    socket.leave(room);

    if (roomData.type === 'multi') {
      socket.to(room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님이 방을 나갔습니다.` });
      if (roomVotes[room]) roomVotes[room].delete(socket.id);
      
      roomData.participants -= 1;
      if (roomData.participants < 2) {
         socket.to(room).emit('partner_left');
         delete activeRooms[room];
         delete roomVotes[room];
      }
    } else {
      delete activeRooms[room];
    }
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        const roomData = activeRooms[room];
        if (!roomData) continue;

        if (roomData.type === 'multi') {
          socket.to(room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님의 연결이 끊어졌습니다.` });
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

// Render 타임아웃 방지용 0.0.0.0 바인딩
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 WE US 구동 완료 (DB연동 완료) (포트: ${PORT})`));