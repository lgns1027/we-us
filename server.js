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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const waitingQueues = {}; 
const matchTimers = {};
const roomVotes = {};     
const activeRooms = {};   

// ★ 속도 최적화를 위해 maxTokens 매개변수 추가
async function getGoogleAIResponse(systemPrompt, history, maxTokens = 150) {
  const modelsToTry = [
    "gemma-3-12b-it", // ★ 27B보다 응답 속도가 3배 빠른 12B를 1순위로 배치
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
      // ★ maxOutputTokens를 걸어 AI가 말을 길게 끌지 못하게 강제 차단 (속도 대폭 상승)
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

function startGroupRoom(queueKey) {
  const users = waitingQueues[queueKey].splice(0, 4); 
  if (users.length < 2) {
    waitingQueues[queueKey] = [...users, ...waitingQueues[queueKey]];
    delete matchTimers[queueKey];
    return;
  }

  const roomName = `room_${Date.now()}`;
  // ★ 방 정보에 isGeneratingReport(자물쇠) 추가
  activeRooms[roomName] = { type: 'multi', history: [], extensionCount: 0, participants: users.length, isGeneratingReport: false };

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
      // ★ 5초 대기를 3초(3000)로 단축
      matchTimers[queueKey] = setTimeout(() => startGroupRoom(queueKey), 3000);
    }
  });

  socket.on('start_ai_chat', (lang) => {
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    socket.userAlias = '나';
    
    activeRooms[roomId] = { type: 'single', lang: lang, history: [], isGeneratingReport: false };
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
    const systemPrompt = `너는 대화방의 'AI 진행자'야. 절대 대화 참여자(익명 A, 익명 B 등)를 연기하거나 대본을 쓰지 마. 10초간 정적이 흘렀으니 어색함을 깰 수 있는 짧고 센스 있는 질문 하나만 던져. 50자 이내.`;
    const aiMessage = await getGoogleAIResponse(systemPrompt, chatHistory, 100);
    
    if (!aiMessage.includes("실패했습니다")) {
      io.to(data.room).emit('receive_message', { sender: 'AI 🤖', text: aiMessage });
    }
  });

  socket.on('request_chemistry_report', async (data) => {
    const roomData = activeRooms[data.room];
    
    // 1. 방이 없거나 대화가 너무 적으면 리포트 불가
    if (!roomData || roomData.history.length < 4) {
      if(roomData && roomData.isGeneratingReport) return; // 이미 다른 기기에서 에러 띄웠으면 무시
      io.to(data.room).emit('receive_report', { error: true });
      return;
    }

    // ★ 2. 중복 방지 자물쇠 (PC와 모바일 1초 차이 튕김 완벽 해결)
    if (roomData.isGeneratingReport) return; 
    roomData.isGeneratingReport = true; // 첫 요청이 들어오면 문을 잠가버림

    let systemPrompt = "";
    let conversationText = "";

    if (roomData.type === 'single') {
      systemPrompt = `이 대화는 사용자가 AI(${roomData.lang})와 진행한 대화 연습이야. 대화를 평가해서 3줄로 요약해. 1. 대화 주도력 점수: (100점 만점) 2. 핵심 키워드: (#해시태그 2개) 3. AI의 피드백: (칭찬이나 조언 한줄평)`;
      conversationText = roomData.history.map(msg => `${msg.role === 'user' ? '나' : 'AI'}: ${msg.content}`).join('\n');
    } else {
      systemPrompt = `대화를 읽고 3줄 요약해. 1. 그룹 티키타카 점수: (100점 만점) 2. 핵심 키워드: (#해시태그 2개) 3. 한줄평`;
      conversationText = roomData.history.join('\n');
    }

    // 리포트는 딱 200토큰만 쓰도록 제한하여 속도 확보
    const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: conversationText }], 200);
    
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