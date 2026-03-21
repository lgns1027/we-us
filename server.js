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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🍃 MongoDB 연결 성공! 대화 기록이 영구 저장됩니다."))
  .catch(err => console.error("❌ DB 연결 실패 (서버 환경을 확인하세요):", err));

// ==========================================
// DB 스키마 정의
// ==========================================

// ★ V2 신규 스키마: 유저 닉네임 및 친구(인맥) 목록 영구 저장용
const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  nickname: { type: String, default: '익명의 소통러' },
  friends: [{ type: String }], 
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// ★ V2 신규 스키마: 1:1 쪽지(DM) 저장용
const DMSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const DM = mongoose.model('DM', DMSchema);

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

const BlacklistSchema = new mongoose.Schema({
  reporterId: String,
  roomName: String,
  reason: String,
  createdAt: { type: Date, default: Date.now }
});
const Blacklist = mongoose.model('Blacklist', BlacklistSchema);

// ==========================================
// 전역 변수 및 헬퍼 함수
// ==========================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const waitingQueues = {}; 
const activeRooms = {};   
const roomVotes = {};

async function getGoogleAIResponse(systemPrompt, history, maxTokens = 150) {
  // ★ 첫 대답 30초 지연 해결을 위해 가장 빠른 flash 모델 최우선 배치
  const modelsToTry = [
    "gemini-1.5-flash", 
    "gemini-2.5-flash",
    "gemini-1.5-pro"
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
      console.error(`🚨 [AI 오류] ${modelName} 통신 실패 - 사유: ${error.message}`);
    }
  }
  return "네트워크가 불안정하여 AI가 답변을 고민하고 있습니다.";
}

function filterProfanity(text) {
  const badWords = ['씨발', '시발', '개새끼', '지랄', '병신', '애미', '존나', '좆']; 
  let filtered = text;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
}

function getPersonaPrompt(topic, isReport = false, partnerRole = '') {
  if (isReport) {
    // ★ API 비용 최소화 및 정확도 향상을 위한 초압축 프롬프트 (3스탯 유지)
    return `대화 기록을 분석하여 다음 딱 2가지만 아주 짧게 작성하세요. 부가 설명 절대 금지.
1. [한줄평]: 대화에 대한 팩트폭력 한줄평 (50자 이내)
2. [점수]: 답변 맨 마지막 줄에 다음 형식으로 참여자의 평균을 평가해 주세요: [LOGIC: 0~100] [LINGUISTICS: 0~100] [EMPATHY: 0~100]`;
  }

  // "진상손님:" 같이 이름표를 붙여서 도배되는 현상 절대 금지 규칙 추가
  const baseConstraint = `\n\n[절대 규칙]: 절대 상대방을 비하하거나 모욕적인 도발을 하지 마세요. 예의를 갖추되 역할에 몰입하세요. 대답할 때 당신의 이름표(예: "${partnerRole}:")를 텍스트 맨 앞에 절대 붙이지 마세요. 반드시 1~2문장 이내(최대 50자 내외)로 자연스럽게 마침표로 끝나는 완성된 문장만 출력하세요. 말이 중간에 끊기면 안 됩니다.`;

  switch(topic) {
    case '진상손님 방어전':
      return `당신은 '${partnerRole}' 역할을 맡았습니다. 진상 손님이라면 까다롭고 집요하게 환불이나 서비스를 요구하세요. 알바생이라면 매뉴얼에 따라 단호하지만 정중하게 방어하세요.` + baseConstraint;
    case '압박 면접':
      return `당신은 '${partnerRole}' 역할을 맡았습니다. 면접관이라면 지원자의 논리적 허점을 파고드는 정중하고 예리한 꼬리질문을 하세요. 지원자라면 긴장하지 않고 본인의 논리를 차분히 어필하세요.` + baseConstraint;
    case '100억 받기 VS 무병장수':
      return `당신은 '${partnerRole}' 입장에서 토론합니다. 상대의 의견에 정중하게 반박하고 당신의 선택이 가진 가치를 논리적으로 설득하세요.` + baseConstraint;
    default:
      return `당신은 '${partnerRole}' 역할을 맡은 대화 파트너입니다. 상호 존중하며 흥미롭고 편안한 대화를 이끌어주세요.` + baseConstraint;
  }
}

function tryMatch(topicKey) {
  const q = waitingQueues[topicKey];
  if (!q) return;

  const createRoom = (user1, user2, role1, role2) => {
    const roomName = `room_${Date.now()}`;
    activeRooms[roomName] = { 
      type: 'multi', 
      history: [], 
      extensionCount: 0, 
      participants: 2, 
      isGeneratingReport: false, 
      topic: topicKey, 
      userIds: new Set([user1.userId, user2.userId].filter(Boolean)),
      endTime: Date.now() + (180 * 1000)
    };

    user1.socket.join(roomName);
    user2.socket.join(roomName);
    
    user1.socket.userAlias = role1;
    user2.socket.userAlias = role2;
    user1.socket.roomName = roomName;
    user2.socket.roomName = roomName;

    io.to(user1.id).emit('matched', { roomName, partner: role2, myRole: role1, participantCount: 2 });
    io.to(user2.id).emit('matched', { roomName, partner: role1, myRole: role2, participantCount: 2 });
    
    console.log(`✅ [매칭 성공] ${roomName} 생성 (${role1} vs ${role2})`);
  };

  if (q.roleA.length > 0 && q.roleB.length > 0) {
    createRoom(q.roleA.shift(), q.roleB.shift(), q.roleA_name, q.roleB_name);
  } else if (q.roleA.length > 0 && q.random.length > 0) {
    createRoom(q.roleA.shift(), q.random.shift(), q.roleA_name, q.roleB_name);
  } else if (q.roleB.length > 0 && q.random.length > 0) {
    createRoom(q.random.shift(), q.roleB.shift(), q.roleA_name, q.roleB_name);
  } else if (q.random.length > 1) {
    createRoom(q.random.shift(), q.random.shift(), q.roleA_name, q.roleB_name);
  }
}

// ==========================================
// 소켓 통신 처리
// ==========================================

io.on('connection', (socket) => {

  // --- [V2: 프로필 & 친구 관리] ---
  socket.on('get_profile', async (userId) => {
    try {
      if (!userId) return;
      let user = await User.findOne({ userId });
      if (!user) user = await User.create({ userId });
      
      const friendsData = await User.find({ userId: { $in: user.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: user.nickname, friends: friendsData });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('update_nickname', async (data) => {
    try {
      if (!data.userId || !data.nickname) return;
      
      // ★ 픽스: findOneAndUpdate 대신 findOne 후 save 방식으로 변경하여 확실하게 저장
      let user = await User.findOne({ userId: data.userId });
      if (!user) {
        user = new User({ userId: data.userId, nickname: data.nickname });
      } else {
        user.nickname = data.nickname;
      }
      await user.save();

      const friendsData = await User.find({ userId: { $in: user.friends } }).select('userId nickname');
      
      // 저장 완료 후 프론트에 즉시 다시 쏴주기
      socket.emit('receive_profile', { nickname: user.nickname, friends: friendsData });
      console.log(`✅ [닉네임 변경 완료] ${data.userId} -> ${user.nickname}`);
    } catch (err) {
      console.error("❌ [닉네임 변경 에러]:", err);
    }
  });

  socket.on('add_friend', async (data) => {
    try {
      if (!data.userId || !data.friendId) return;
      const user = await User.findOne({ userId: data.userId });
      if (user && !user.friends.includes(data.friendId)) {
        user.friends.push(data.friendId);
        await user.save();
      }
      
      const updatedUser = await User.findOne({ userId: data.userId });
      const friendsData = await User.find({ userId: { $in: updatedUser.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: updatedUser.nickname, friends: friendsData });
    } catch (err) {
      console.error("❌ [친구 추가 에러]:", err);
    }
  });

  // --- [V2: 1:1 쪽지 (DM) 관리] ---
  socket.on('get_dms', async ({ userId, friendId }) => {
    try {
      const dms = await DM.find({
        $or: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId }
        ]
      }).sort({ createdAt: 1 });
      socket.emit('receive_dms', dms);
    } catch (err) {
      console.error("❌ [DM 불러오기 에러]:", err);
    }
  });

  socket.on('send_dm', async ({ senderId, receiverId, text }) => {
    try {
      const cleanText = filterProfanity(text);
      const newMsg = await DM.create({ senderId, receiverId, text: cleanText });
      
      // 방 전체가 아닌 글로벌로 쏴서, 연결된 대상이 있다면 받도록 처리
      io.emit('new_dm_arrived', newMsg);
    } catch (err) {
      console.error("❌ [DM 전송 에러]:", err);
    }
  });

  // --- [기존 대화방 매칭 & 로직] ---
  socket.on('join_queue', (data) => {
    const { topic, role, roleA_name, roleB_name, userId } = data;
    
    if (!waitingQueues[topic]) {
      waitingQueues[topic] = { roleA: [], roleB: [], random: [], roleA_name, roleB_name };
    }
    
    const queueData = { id: socket.id, socket: socket, userId: userId };

    if (role === 'A') waitingQueues[topic].roleA.push(queueData);
    else if (role === 'B') waitingQueues[topic].roleB.push(queueData);
    else waitingQueues[topic].random.push(queueData);

    socket.queueTopic = topic;
    socket.queueRole = role || 'random';

    console.log(`⏳ [대기열 진입] 유저: ${socket.id} | 주제: ${topic} | 역할: ${role}`);
    tryMatch(topic);
  });

  socket.on('leave_queue', () => {
    const topic = socket.queueTopic;
    const role = socket.queueRole;
    if (topic && waitingQueues[topic]) {
      const targetQueue = role === 'A' ? 'roleA' : role === 'B' ? 'roleB' : 'random';
      waitingQueues[topic][targetQueue] = waitingQueues[topic][targetQueue].filter(s => s.id !== socket.id);
      console.log(`📉 [대기열 취소] 유저: ${socket.id} | 주제: ${topic}`);
      socket.queueTopic = null;
      socket.queueRole = null;
    }
  });

  socket.on('start_ai_chat', (data) => {
    const { topic, myRole, aiRole, userId } = data;
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    
    socket.userAlias = myRole;
    socket.aiPartnerRole = aiRole; 
    
    activeRooms[roomId] = { 
      type: 'single', 
      topic: topic, 
      history: [], 
      isGeneratingReport: false,
      userIds: new Set(userId ? [userId] : []), 
      endTime: Date.now() + (180 * 1000) 
    };

    socket.emit('matched', { roomId: roomId, partner: aiRole, myRole: myRole, participantCount: 2 });
    socket.emit('receive_message', { sender: 'System', text: `[시스템] '${topic}' 모드가 시작되었습니다. 당신은 [${myRole}]입니다.` });
    console.log(`🤖 [AI 방 생성] ${roomId} (${myRole} vs AI ${aiRole})`);
  });

  socket.on('send_message', async (data) => {
    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    const cleanText = filterProfanity(data.text);

    if (roomData.type === 'multi') {
      roomData.history.push(`${socket.userAlias}: ${cleanText}`);
      socket.to(data.room).emit('receive_message', { sender: socket.userAlias, text: cleanText });
    } 
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: cleanText }); 
      
      const systemPrompt = getPersonaPrompt(roomData.topic, false, socket.aiPartnerRole);
      let aiReply = await getGoogleAIResponse(systemPrompt, roomData.history.slice(-8), 150); 
      
      // 이름표 강제 삭제 필터
      aiReply = aiReply.replace(/^.*?:/, '').trim();
      
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      socket.emit('receive_message', { sender: socket.aiPartnerRole, text: aiReply });
    }
  });

  socket.on('report_user', async (data) => {
    try {
      await Blacklist.create({
        reporterId: data.reporterId,
        roomName: data.room,
        reason: data.reason
      });
      console.log(`🚨 [신고 접수 완료] 방: ${data.room} | 사유: ${data.reason}`);
    } catch (err) {
      console.error("❌ [신고 DB 저장 실패]:", err);
    }
  });

  socket.on('request_ai_help', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;
    
    const chatHistory = data.history.slice(-5).map(msg => ({ role: 'user', content: `${msg.sender}: ${msg.text}` }));
    const systemPrompt = `당신은 정중한 대화 중재자입니다. 10초간 정적이 흘렀습니다. 대화 문맥을 파악해 상대방이 부담 없이 대답할 수 있는 질문을 하나 던져 대화를 부드럽게 유도하세요. 절대 도발하지 말고, 50자 이내의 완성된 한 문장으로 대답하세요.`;
    
    const aiMessage = await getGoogleAIResponse(systemPrompt, chatHistory, 100);
    
    if (!aiMessage.includes("불안정하여")) {
      io.to(data.room).emit('receive_message', { sender: 'AI 가이드 💡', text: aiMessage });
    }
  });

  socket.on('request_chemistry_report', (data) => {
    const roomData = activeRooms[data.room];
    if (roomData && data.userId) {
      roomData.userIds.add(data.userId);
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
      console.error("❌ [내 기록 조회 에러]:", err);
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
      roomData.endTime += (120 * 1000); 
      io.to(room).emit('time_extended', { addedTime: 120, currentExtensions: roomData.extensionCount });
      roomVotes[room].clear();
      console.log(`⏱️ [시간 연장] 방: ${room} (현재 ${roomData.extensionCount}회 연장)`);
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
      
      roomData.participants -= 1;
      if (roomData.participants < 2) {
         socket.to(room).emit('partner_left');
         delete activeRooms[room];
         if (roomVotes[room]) delete roomVotes[room];
         console.log(`🚪 [방 파기] 인원 부족으로 ${room} 종료`);
      }
    } else {
      delete activeRooms[room];
    }
  });

  socket.on('disconnect', () => {
    if (socket.queueTopic && waitingQueues[socket.queueTopic]) {
      const targetQueue = socket.queueRole === 'A' ? 'roleA' : socket.queueRole === 'B' ? 'roleB' : 'random';
      waitingQueues[socket.queueTopic][targetQueue] = waitingQueues[socket.queueTopic][targetQueue].filter(s => s.id !== socket.id);
      console.log(`📉 [대기열 이탈(연결끊김)] 유저: ${socket.id}`);
    }
  });
});

// ==========================================
// 서버 타이머: 시간 초과 시 리포트 자동 생성
// ==========================================

setInterval(async () => {
  const now = Date.now();
  for (const room in activeRooms) {
    const roomData = activeRooms[room];
    
    if (now >= roomData.endTime && !roomData.isGeneratingReport) {
      roomData.isGeneratingReport = true;
      console.log(`⏱️ [서버 타이머] ${room} 대화 종료. AI 판정 리포트 생성 시작...`);

      if (roomData.history.length < 4) {
        io.to(room).emit('receive_report', { error: true });
        console.log(`⚠️ [리포트 스킵] ${room} 대화 기록 부족`);
        continue;
      }
      
      const systemPrompt = getPersonaPrompt(roomData.topic, true);
      
      // 싱글 모드 DB 저장 시 객체 데이터 에러 방지 처리 추가
      const conversationText = roomData.type === 'single'
        ? roomData.history.map(msg => `${msg.role === 'user' ? '나' : '상대방'}: ${msg.content}`).join('\n')
        : roomData.history.join('\n');
      
      // API 토큰 낭비를 막기 위해 maxTokens를 150으로 제한
      const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: conversationText }], 150); 
      
      let logicScore = 50, linguisticsScore = 50, empathyScore = 50;
      const logicMatch = reportContent.match(/\[LOGIC:\s*(\d+)\]/i);
      const linguisticsMatch = reportContent.match(/\[LINGUISTICS:\s*(\d+)\]/i);
      const empathyMatch = reportContent.match(/\[EMPATHY:\s*(\d+)\]/i);

      if (logicMatch) logicScore = parseInt(logicMatch[1]);
      if (linguisticsMatch) linguisticsScore = parseInt(linguisticsMatch[1]);
      if (empathyMatch) empathyScore = parseInt(empathyMatch[1]);
      
      const cleanReportText = reportContent.replace(/\[LOGIC:.*\]|\[LINGUISTICS:.*\]|\[EMPATHY:.*\]/gi, '').trim();

      try {
        if (!reportContent.includes("불안정하여")) {
          await Report.create({
            roomName: room, 
            userIds: Array.from(roomData.userIds), 
            type: roomData.type,
            topic: roomData.topic, 
            participants: roomData.participants, 
            fullLog: roomData.type === 'single' ? roomData.history.map(m => m.content) : roomData.history,
            aiReport: cleanReportText, 
            stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore }
          });
          console.log(`💾 [DB 저장 완료] ${room} 리포트 저장 성공`);
        }
      } catch (dbError) {
        console.error("❌ [DB 저장 에러]:", dbError);
      }

      if (reportContent.includes("불안정하여")) {
        io.to(room).emit('receive_report', { error: true });
      } else {
        io.to(room).emit('receive_report', { 
          reportText: cleanReportText, 
          stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore },
          partnerId: Array.from(roomData.userIds).find(id => id !== null) 
        });
      }
    }
  }
}, 1000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 WE US 서버 구동 완료 (포트: ${PORT})`));