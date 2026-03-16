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

// 다중 유저 ID 저장을 위한 배열 추가
const ReportSchema = new mongoose.Schema({
  roomName: String,
  userIds: [String], 
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

// --- [3. AI 통신 엔진 (Gemma 3중 루프 원상 복구)] ---
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
  return "네트워크가 불안정하여 AI가 답변을 고민하고 있습니다.";
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
    isGeneratingReport: false,
    lang: queueKey.split('_')[0],
    topic: queueKey.split('_')[1],
    userIds: new Set()
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
      matchTimers[queueKey] = setTimeout(() => startGroupRoom(queueKey), 3000); 
    }
  });

  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    socket.userAlias = '나';
    
    activeRooms[roomId] = { 
      type: 'single', 
      lang: lang, 
      topic: 'AI 연습', 
      history: [], 
      isGeneratingReport: false,
      userIds: new Set() 
    };
    socket.emit('matched', { roomId: roomId, partner: `수석 ${lang} 튜터`, participantCount: 2 });
    
    const welcomeMsg = `환영합니다. 저는 당신의 ${lang} 회화 파트너입니다. 어떤 주제든 편하게 말씀해 주시면, 자연스러운 대화와 함께 필요한 교정을 도와드리겠습니다.`;
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
      const systemPrompt = `당신은 최고 수준의 '${roomData.lang}' 원어민 튜터입니다. 사용자의 언어 학습을 돕고, 지적이고 자연스러운 대화를 이끌어주세요. 만약 문법이나 표현이 어색하다면 대화 끝에 '[💡 교정: 올바른 표현]' 형식으로 부드럽게 피드백을 추가하세요.`;
      
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
    
    const systemPrompt = `당신은 수준 높은 살롱(Salon)의 '대화 모더레이터'입니다. 참가자들 사이에 10초간 정적이 흘렀습니다. 앞선 대화 문맥을 파악하여, 대화가 다시 자연스럽게 이어질 수 있도록 깊이 있고 생각할 거리를 던지는 부드러운 질문을 하나만 던지세요. 50자 이내로 정중하게 작성하세요.`;
    const aiMessage = await getGoogleAIResponse(systemPrompt, chatHistory, 100);
    
    if (!aiMessage.includes("불안정하여")) {
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    }
  });

  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    
    if (!roomData || roomData.history.length < 4) {
      if(roomData && roomData.isGeneratingReport) return;
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }

    if (data.userId) {
      roomData.userIds.add(data.userId);
    }

    if (roomData.isGeneratingReport) return; 
    roomData.isGeneratingReport = true; 

    let systemPrompt = "";
    let conversationText = "";

    if (roomData.type === 'single') {
      systemPrompt = `사용자가 AI와 진행한 '${roomData.lang}' 어학 및 소통 기록입니다. 언어/커뮤니케이션 전문가의 시선으로 다음 형식에 맞춰 분석 리포트를 작성하세요.\n\n[퍼스널 커뮤니케이션 분석]\n1. 종합 성취도: (100점 만점)\n2. 대화의 강점: (문법, 어휘, 표현력 등 뛰어난 점 1줄)\n3. 성장을 위한 조언: (더 자연스러운 소통을 위한 팁 1줄)`;
      conversationText = roomData.history.map(msg => `${msg.role === 'user' ? '나' : 'AI'}: ${msg.content}`).join('\n');
    } else {
      systemPrompt = `익명 참가자들이 나눈 대화 기록입니다. 전문 모더레이터의 시선으로 다음 형식에 맞춰 그룹 케미스트리 리포트를 작성하세요.\n\n[그룹 케미스트리 분석]\n1. 대화 밀도: (100점 만점 - 티키타카 및 깊이 평가)\n2. 대화의 핵심 키워드: (#해시태그 3개)\n3. 모더레이터의 총평: (대화의 흐름과 참가자들의 시너지에 대한 우아하고 통찰력 있는 한줄평)`;
      conversationText = roomData.history.join('\n');
    }

    const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: conversationText }], 200);
    
    try {
      if (!reportContent.includes("불안정하여")) {
        await Report.create({
          roomName: data.room,
          userIds: Array.from(roomData.userIds), 
          type: roomData.type,
          lang: roomData.lang || '알 수 없음',
          topic: roomData.topic || '알 수 없음',
          participants: roomData.participants || 2,
          fullLog: roomData.type === 'single' ? roomData.history.map(m => m.content) : roomData.history,
          aiReport: reportContent
        });
        console.log(`✅ ${data.room} DB 저장 완료! (참여 유저 ID: ${Array.from(roomData.userIds).join(', ')})`);
      }
    } catch (dbError) {
      console.error("🔥 DB 저장 실패:", dbError);
    }

    if (reportContent.includes("불안정하여")) {
      io.to(data.room).emit('receive_report', { error: true });
    } else {
      io.to(data.room).emit('receive_report', { reportText: reportContent });
    }
  });

  socket.on('request_my_records', async (userId) => {
    try {
      if (!userId) return;
      const myRecords = await Report.find({ userIds: userId })
                                    .sort({ createdAt: -1 })
                                    .limit(20);
      socket.emit('receive_my_records', myRecords);
    } catch (err) {
      console.error("❌ 내 기록 조회 에러:", err);
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
      socket.to(room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님이 대화방을 정중히 퇴장하셨습니다.` });
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 WE US 구동 완료 (DB연동 완료) (포트: ${PORT})`));