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

// ★ 진화 1: 대화 리포트 스키마에 AI가 추출한 '세부 스탯(Stats)' 추가
const ReportSchema = new mongoose.Schema({
  roomName: String,
  userIds: [String], 
  type: String, 
  topic: String, 
  participants: Number,
  fullLog: [String],
  aiReport: String,
  stats: {
    logic: { type: Number, default: 50 },
    linguistics: { type: Number, default: 50 },
    empathy: { type: Number, default: 50 }
  },
  createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', ReportSchema);

// ★ 진화 2: 트롤 유저 영구 박제를 위한 블랙리스트 스키마 추가
const BlacklistSchema = new mongoose.Schema({
  reporterId: String,
  roomName: String,
  reason: String,
  createdAt: { type: Date, default: Date.now }
});
const Blacklist = mongoose.model('Blacklist', BlacklistSchema);

// --- [2. 상태 관리 변수] ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const waitingQueues = {}; 
const matchTimers = {};
const roomVotes = {};     
const activeRooms = {};   

// --- [3. AI 통신 엔진 (Gemma 3중 루프 완벽 보존)] ---
async function getGoogleAIResponse(systemPrompt, history, maxTokens = 250) {
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

// ★ 진화 3: 욕설 필터링 함수 (서버단에서 원천 차단)
function filterProfanity(text) {
  const badWords = ['씨발', '시발', '개새끼', '지랄', '병신', '애미', '존나', '좆']; 
  let filtered = text;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}

// 다중 페르소나 및 데이터 추출 프롬프트 생성기
function getPersonaPrompt(topic, isReport = false) {
  if (isReport) {
    const basePrompt = `대화 기록을 전문가의 시선으로 분석하여 1. 대화 밀도(100점 만점) 2. 핵심 키워드(#해시태그) 3. 총평을 3줄로 작성하세요.`;
    // ★ 빅데이터 시각화를 위해 AI에게 정확한 규격으로 점수를 뱉어내도록 강제
    const statsInstruction = `\n\n반드시 답변 맨 마지막 줄에 다음 형식으로 참가자의 평균 능력치를 평가해 적어주세요: [LOGIC: 0~100사이숫자] [LINGUISTICS: 0~100사이숫자] [EMPATHY: 0~100사이숫자]`;
    
    if (['한국어', '영어', '일본어', '프랑스어'].includes(topic)) {
      return `사용자가 AI와 진행한 '${topic}' 어학 기록입니다. 1. 종합 성취도 2. 대화의 강점 3. 성장을 위한 조언을 작성하세요.` + statsInstruction;
    } else {
      return basePrompt + statsInstruction;
    }
  }

  switch(topic) {
    case '한국어': case '영어': case '일본어': case '프랑스어':
      return `당신은 최고 수준의 '${topic}' 원어민 튜터입니다. 사용자의 언어 학습을 돕고 지적인 대화를 이끌어주세요. 어색한 표현이 있다면 대화 끝에 '[💡 교정: 올바른 표현]'을 부드럽게 추가하세요.`;
    case '최악의 이불킥 경험':
      return `당신은 심리 상담가이자 우아한 대화 모더레이터입니다. 사용자의 부끄러운 경험을 경청하고 인간적인 공감과 함께 유쾌하게 분위기를 풀어주세요.`;
    case '자본주의 생존기':
      return `당신은 자본주의 시스템과 권력 구조의 이면을 꿰뚫어 보는 날카로운 지식인입니다. 현대 사회의 부조리와 돈의 논리에 대해 깊이 있고 도발적인 질문을 던지며 토론을 이끌어주세요.`;
    case '100억 받기 VS 무병장수':
      return `당신은 토론의 '악마의 대변인'입니다. 사용자가 100억을 고르면 무병장수의 가치로 공격하고, 무병장수를 고르면 100억이 주는 권력과 자유를 무기로 무자비하게 반박하세요.`;
    case '진상손님 방어전 (알바생)':
      return `당신은 극악무도하고 논리가 통하지 않는 진상 손님입니다. 사용자는 알바생입니다. 말도 안 되는 이유로 환불이나 서비스를 요구하며 사용자의 멘탈을 흔드세요. 절대 쉽게 물러서지 마세요.`;
    case '압박 면접 (지원자)':
      return `당신은 피도 눈물도 없는 대기업의 수석 면접관입니다. 사용자는 지원자입니다. 사용자의 답변에 꼬리를 물고, 구조적인 허점을 파고드는 날카롭고 차가운 압박 질문만 던지세요.`;
    default:
      return `당신은 수준 높은 살롱(Salon)의 대화 파트너입니다. 깊이 있고 흥미로운 대화를 이끌어주세요.`;
  }
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
    const lang = data?.lang || '공통';
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

  socket.on('start_ai_chat', (topic) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    socket.userAlias = '나';
    
    activeRooms[roomId] = { 
      type: 'single', 
      topic: topic, 
      history: [], 
      isGeneratingReport: false,
      userIds: new Set() 
    };
    
    let partnerName = '대화 파트너';
    if (['한국어', '영어', '일본어', '프랑스어'].includes(topic)) partnerName = `수석 ${topic} 튜터`;
    else if (topic === '진상손님 방어전 (알바생)') partnerName = '진상 손님 🤬';
    else if (topic === '압박 면접 (지원자)') partnerName = '수석 면접관 👔';
    else partnerName = '살롱 모더레이터 🍷';

    socket.emit('matched', { roomId: roomId, partner: partnerName, participantCount: 2 });
    
    const welcomeMsg = `[시스템] '${topic}' 모드가 시작되었습니다. 먼저 대화를 건네보세요!`;
    socket.emit('receive_message', { sender: 'System', text: welcomeMsg });
  });

  socket.on('send_message', async (data) => {
    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    // ★ 욕설 마스킹 적용
    const cleanText = filterProfanity(data.text);

    if (roomData.type === 'multi') {
      roomData.history.push(`${socket.userAlias}: ${cleanText}`);
      socket.to(data.room).emit('receive_message', { sender: socket.userAlias, text: cleanText });
    } 
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: cleanText }); 
      
      const systemPrompt = getPersonaPrompt(roomData.topic, false);
      const aiReply = await getGoogleAIResponse(systemPrompt, roomData.history.slice(-8), 150);
      
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      socket.emit('receive_message', { sender: 'AI 🤖', text: aiReply });
    }
  });

  // ★ 신고 접수 소켓
  socket.on('report_user', async (data) => {
    try {
      await Blacklist.create({
        reporterId: data.reporterId,
        roomName: data.room,
        reason: data.reason
      });
      console.log(`🚨 신고 접수 완료: [${data.room}] 사유: ${data.reason}`);
    } catch (err) {
      console.error("신고 DB 저장 실패:", err);
    }
  });

  socket.on('request_ai_help', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;

    const chatHistory = data.history.slice(-5).map(msg => ({
      role: msg.sender === '나' || msg.sender.includes('익명') ? 'user' : 'assistant',
      content: `${msg.sender}: ${msg.text}`
    }));
    
    const systemPrompt = `당신은 '${roomData.topic}' 주제의 대화 모더레이터입니다. 참가자들 사이에 10초간 정적이 흘렀습니다. 앞선 대화 문맥을 파악하여 50자 이내로 예리하게 정적을 깨는 질문을 던지세요.`;
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

    if (data.userId) roomData.userIds.add(data.userId);
    if (roomData.isGeneratingReport) return; 
    roomData.isGeneratingReport = true; 

    const systemPrompt = getPersonaPrompt(roomData.topic, true);
    const conversationText = roomData.type === 'single' 
      ? roomData.history.map(msg => `${msg.role === 'user' ? '나' : 'AI'}: ${msg.content}`).join('\n')
      : roomData.history.join('\n');

    const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: conversationText }], 300);
    
    // ★ 정규식을 이용해 AI 응답에서 능력치 점수 파싱
    let logicScore = 50, linguisticsScore = 50, empathyScore = 50;
    const logicMatch = reportContent.match(/\[LOGIC:\s*(\d+)\]/i);
    const linguisticsMatch = reportContent.match(/\[LINGUISTICS:\s*(\d+)\]/i);
    const empathyMatch = reportContent.match(/\[EMPATHY:\s*(\d+)\]/i);

    if (logicMatch) logicScore = parseInt(logicMatch[1]);
    if (linguisticsMatch) linguisticsScore = parseInt(linguisticsMatch[1]);
    if (empathyMatch) empathyScore = parseInt(empathyMatch[1]);

    // 화면에 보여줄 때는 지저분한 태그를 지워버림
    const cleanReportText = reportContent.replace(/\[LOGIC:.*\]|\[LINGUISTICS:.*\]|\[EMPATHY:.*\]/gi, '').trim();

    try {
      if (!reportContent.includes("불안정하여")) {
        await Report.create({
          roomName: data.room,
          userIds: Array.from(roomData.userIds), 
          type: roomData.type,
          topic: roomData.topic || '알 수 없음',
          participants: roomData.participants || 2,
          fullLog: roomData.type === 'single' ? roomData.history.map(m => m.content) : roomData.history,
          aiReport: cleanReportText,
          stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore }
        });
      }
    } catch (dbError) {
      console.error("🔥 DB 저장 실패:", dbError);
    }

    if (reportContent.includes("불안정하여")) {
      io.to(data.room).emit('receive_report', { error: true });
    } else {
      io.to(data.room).emit('receive_report', { reportText: cleanReportText });
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
      socket.to(room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님이 퇴장하셨습니다.` });
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