require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🍃 MongoDB 연결 성공! 대화 기록 영구 저장 활성화"))
  .catch(err => console.error("❌ DB 연결 실패:", err));

// ==========================================
// DB 스키마 정의 (가독성 최적화)
// ==========================================
const User = mongoose.model('User', new mongoose.Schema({
  userId: { type: String, unique: true }, nickname: { type: String, default: '익명의 소통러' },
  friends: [{ type: String }], pushToken: { type: String, default: '' }, blockedUsers: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
}));

const DM = mongoose.model('DM', new mongoose.Schema({
  senderId: String, receiverId: String, text: String, createdAt: { type: Date, default: Date.now }
}));

const Report = mongoose.model('Report', new mongoose.Schema({
  roomName: String, userIds: [String], type: String, topic: String, participants: Number,
  fullLog: [String], aiReport: String, stats: { logic: { type: Number, default: 50 }, linguistics: { type: Number, default: 50 }, empathy: { type: Number, default: 50 } },
  createdAt: { type: Date, default: Date.now }
}));

const Blacklist = mongoose.model('Blacklist', new mongoose.Schema({
  reporterId: String, roomName: String, reason: String, createdAt: { type: Date, default: Date.now }
}));

// ==========================================
// 전역 변수 및 헬퍼 함수
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const waitingQueues = {}, activeRooms = {}, roomVotes = {}, openLoungeHistory = [];
const rateLimits = new Map(); // 7연속 도배 3초 뮤트용 맵

let globalScoreT = 0, globalScoreF = 0;

// ★ 닉네임 유령 계정 생성 방지를 위한 절대 필터 함수
function extractId(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.userId) {
      if (typeof val.userId === 'string') return val.userId;
      if (typeof val.userId === 'object' && val.userId.userId) return String(val.userId.userId);
    }
  }
  return String(val);
}

const CURRENT_EVENT = {
  topic: "🔥 MBTI 멸망전: T vs F", desc: "주말 한정 스페셜 큐 오픈! 이긴 진영의 점수가 누적됩니다.",
  roleA: "극T (팩트폭행)", roleB: "극F (감성공감)",
  missionA: "당신은 지독한 T입니다. 감정 호소는 집어치우고 오직 팩트와 논리로만 상대방의 주장을 박살내세요.",
  missionB: "당신은 지독한 F입니다. 차가운 논리보다는 인간적인 공감과 따뜻한 감성으로 상대방의 마음을 흔드세요.",
  aiPrompt: "상대방의 논리나 감성적 주장을 완벽하게 타파하세요."
};

// ★ 주말(토,일)에만 동적 이벤트 반환
function getCurrentEvent() {
  return [0, 6].includes(new Date().getDay()) ? CURRENT_EVENT : null;
}

// 비속어 필터
const PROFANITY_REGEX = /씨발|시발|개새끼|지랄|병신|애미|존나|좆/gi;
function filterProfanity(text) { return text.replace(PROFANITY_REGEX, '***'); }

async function getGoogleAIResponse(systemPrompt, history, maxTokens = 300) {
  const modelsToTry = ["gemma-3-12b", "gemma-3-27b", "gemma-3-4b"];
  const contents = history.map((msg, idx) => ({ 
    role: msg.role === 'assistant' ? 'model' : 'user', 
    parts: [{ text: (idx === 0 && msg.role !== 'assistant') ? `[시스템 지시사항: ${systemPrompt}]\n\n사용자 메시지: ${msg.content}` : msg.content }] 
  }));

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { maxOutputTokens: maxTokens } });
      const result = await model.generateContent({ contents });
      const responseText = result.response.text();
      if (responseText && responseText.trim()) return responseText.trim();
    } catch (error) { console.error(`🚨 [AI 오류] ${modelName} 통신 실패:`, error.message); }
  }
  return "네트워크가 불안정하여 AI가 답변을 고민하고 있습니다.";
}

function getPersonaPrompt(topic, isReport = false, partnerRole = '') {
  if (isReport) {
    return `대화 기록을 분석하여 다음 2가지를 작성하세요. 부가설명 금지.\n1. [한줄평]: 팩트폭력 한줄평 (50자 이내)\n2. [점수]: 맨 마지막에 [LOGIC: 0~100] [LINGUISTICS: 0~100] [EMPATHY: 0~100] 형식으로 평가.`;
  }
  
  const pRole = (!partnerRole || partnerRole === 'undefined') ? '익명' : partnerRole;
  const baseConstraint = `\n\n[절대 규칙]: 상대 비하 및 모욕 금지. 대답 시 이름표("${pRole}:") 절대 붙이지 말 것. 1~2문장(50자 내외) 완성된 문장으로만 출력.`;

  const activeEvent = getCurrentEvent();
  if (activeEvent && topic === activeEvent.topic) return `당신은 '${pRole}' 입장에서 토론합니다. ${activeEvent.aiPrompt}${baseConstraint}`;

  switch(topic) {
    case '진상손님 방어전': return `당신은 '${pRole}'입니다. 진상 손님은 집요하게 요구하고, 알바생은 매뉴얼에 따라 단호히 방어하세요.${baseConstraint}`;
    case '압박 면접': return `당신은 '${pRole}'입니다. 면접관은 예리한 꼬리질문을, 지원자는 차분히 어필하세요.${baseConstraint}`;
    case '100억 받기 VS 무병장수': return `당신은 '${pRole}' 입장에서 토론합니다. 상대를 논리적으로 설득하세요.${baseConstraint}`;
    default: return `당신은 '${pRole}'입니다. 일상속에서 가볍게 웃고 떠들 수 있을만한 주제로 이야기해보세요.${baseConstraint}`;
  }
}

function tryMatch(topicKey) {
  const q = waitingQueues[topicKey];
  if (!q) return;

  const createRoom = (u1, u2, r1, r2) => {
    const roomName = `room_${Date.now()}`;
    activeRooms[roomName] = { 
      type: 'multi', history: [], extensionCount: 0, participants: 2, isGeneratingReport: false, 
      topic: topicKey, userIds: new Set([u1.userId, u2.userId].filter(Boolean)), endTime: Date.now() + (180 * 1000),
      roleA: r1, roleB: r2, spectators: new Set(), votesA: 0, votesB: 0, mbtiGuesses: {}, lastSender: null, consecutiveCount: 0
    };

    [u1, u2].forEach((u, i) => {
      u.socket.join(roomName); u.socket.userAlias = i === 0 ? r1 : r2; u.socket.roomName = roomName;
      io.to(u.id).emit('matched', { roomName, partner: i === 0 ? r2 : r1, myRole: i === 0 ? r1 : r2, participantCount: 2 });
    });
  };

  const rA = q.roleA_name || '익명';
  const rB = q.roleB_name || '익명';

  if (q.roleA.length > 0 && q.roleB.length > 0) createRoom(q.roleA.shift(), q.roleB.shift(), rA, rB);
  else if (q.roleA.length > 0 && q.random.length > 0) createRoom(q.roleA.shift(), q.random.shift(), rA, rB);
  else if (q.roleB.length > 0 && q.random.length > 0) createRoom(q.random.shift(), q.roleB.shift(), rA, rB);
  else if (q.random.length > 1) createRoom(q.random.shift(), q.random.shift(), rA, rB);
}

// ==========================================
// 소켓 통신 처리
// ==========================================
io.on('connection', (socket) => {

  socket.emit('faction_score_update', { T: globalScoreT, F: globalScoreF, currentEvent: getCurrentEvent() });

  // ★ 닉네임 유령계정 버그 해결을 위한 복구 시스템
  socket.on('recover_account_by_token', async (token, callback) => {
    try {
      if (!token) return callback(null);
      const user = await User.findOne({ pushToken: token });
      if (user && typeof callback === 'function') callback(user.userId);
      else if (typeof callback === 'function') callback(null);
    } catch (e) { if(typeof callback === 'function') callback(null); }
  });

  socket.on('register_push_token', async (data) => {
    try {
      const uid = extractId(data.userId || data);
      if (!uid || !data.token) return;
      await User.updateOne({ userId: uid }, { $set: { pushToken: data.token } }, { upsert: true });
    } catch (err) {}
  });

  // --- [V2: 프로필 & 친구 & 닉네임 (버그 완벽 차단)] ---
  socket.on('get_profile', async (data) => {
    try {
      const uid = extractId(data);
      if (!uid) return;
      await User.updateOne({ userId: uid }, { $setOnInsert: { nickname: '익명의 소통러', friends: [], blockedUsers: [] } }, { upsert: true });
      const user = await User.findOne({ userId: uid });
      const friendsData = await User.find({ userId: { $in: user.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: user.nickname, friends: friendsData });
    } catch (err) {}
  });

  socket.on('update_nickname', async (data) => {
    try {
      const uid = extractId(data.userId);
      if (!uid || !data.nickname) return;
      await User.updateOne({ userId: uid }, { $set: { nickname: data.nickname } }, { upsert: true });
      socket.loungeNickname = data.nickname; 
      const finalUser = await User.findOne({ userId: uid });
      const friendsData = await User.find({ userId: { $in: finalUser.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: finalUser.nickname, friends: friendsData });
    } catch (err) {}
  });

  socket.on('add_friend', async (data) => {
    try {
      const uid = extractId(data.userId);
      if (!uid || !data.friendId) return;
      await User.updateOne({ userId: uid }, { $addToSet: { friends: data.friendId } });
      const updatedUser = await User.findOne({ userId: uid });
      const friendsData = await User.find({ userId: { $in: updatedUser.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: updatedUser.nickname, friends: friendsData });
    } catch (err) {}
  });

  // --- [V2: DM 및 차단 관리] ---
  socket.on('get_dms', async (data) => {
    try {
      const uid = extractId(data.userId);
      if (!uid || !data.friendId) return;
      const dms = await DM.find({ $or: [{ senderId: uid, receiverId: data.friendId }, { senderId: data.friendId, receiverId: uid }] }).sort({ createdAt: 1 });
      socket.emit('receive_dms', dms);
    } catch (err) {}
  });

  socket.on('send_dm', async (data) => {
    try {
      const senderId = extractId(data.senderId);
      if (!senderId || !data.receiverId || !data.text) return;

      const receiver = await User.findOne({ userId: data.receiverId });
      if (receiver && receiver.blockedUsers && receiver.blockedUsers.includes(senderId)) return;

      const cleanText = filterProfanity(data.text);
      const newMsg = await DM.create({ senderId, receiverId: data.receiverId, text: cleanText });
      io.emit('new_dm_arrived', newMsg);

      if (receiver && receiver.pushToken) {
        const sender = await User.findOne({ userId: senderId });
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: receiver.pushToken, sound: 'default', title: `💬 WE US - ${sender ? sender.nickname : '익명'}님의 쪽지`, body: cleanText, data: { screen: 'profile', senderId } })
        });
      }
    } catch (err) {}
  });

  socket.on('block_user', async (data) => {
    try {
      const uid = extractId(data.userId);
      if (!uid || !data.room || !activeRooms[data.room]) return;
      const partnerId = Array.from(activeRooms[data.room].userIds).find(id => id !== uid);
      if (partnerId) await User.updateOne({ userId: uid }, { $addToSet: { blockedUsers: partnerId } });
    } catch (err) {}
  });

  // --- [대화방 매칭 및 채팅] ---
  socket.on('join_queue', (data) => {
    const uid = extractId(data.userId);
    if (!uid) return;
    if (!waitingQueues[data.topic]) waitingQueues[data.topic] = { roleA: [], roleB: [], random: [], roleA_name: data.roleA_name, roleB_name: data.roleB_name };
    waitingQueues[data.topic][data.role === 'A' ? 'roleA' : data.role === 'B' ? 'roleB' : 'random'].push({ id: socket.id, socket, userId: uid });
    socket.queueTopic = data.topic; socket.queueRole = data.role || 'random';
    tryMatch(data.topic);
  });

  socket.on('leave_queue', () => {
    if (socket.queueTopic && waitingQueues[socket.queueTopic]) {
      const q = socket.queueRole === 'A' ? 'roleA' : socket.queueRole === 'B' ? 'roleB' : 'random';
      waitingQueues[socket.queueTopic][q] = waitingQueues[socket.queueTopic][q].filter(s => s.id !== socket.id);
      socket.queueTopic = null; socket.queueRole = null;
    }
  });

  socket.on('start_ai_chat', (data) => {
    const uid = extractId(data.userId);
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    socket.userAlias = data.myRole || '익명'; socket.aiPartnerRole = data.aiRole || '익명'; 
    activeRooms[roomId] = { type: 'single', topic: data.topic, history: [], isGeneratingReport: false, userIds: new Set(uid ? [uid] : []), endTime: Date.now() + (180 * 1000), lastSender: null, consecutiveCount: 0 };
    socket.emit('matched', { roomId, partner: socket.aiPartnerRole, myRole: socket.userAlias, participantCount: 2 });
    socket.emit('receive_message', { sender: 'System', text: `[시스템] '${data.topic}' 모드가 시작되었습니다. 당신은 [${socket.userAlias}]입니다.` });
  });

  // ★ 7연속 도배 3초 뮤트
  socket.on('send_message', async (data) => {
    const now = Date.now();
    if (now < (rateLimits.get(socket.id + '_mute') || 0)) return; 

    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    const userStats = rateLimits.get(socket.id + '_stats') || { sender: null, count: 0 };
    if (userStats.sender === socket.userAlias) userStats.count++;
    else { userStats.sender = socket.userAlias; userStats.count = 1; }
    rateLimits.set(socket.id + '_stats', userStats);

    if (userStats.count >= 7) {
      rateLimits.set(socket.id + '_mute', now + 3000);
      userStats.count = 0;
      return socket.emit('receive_message', { sender: 'System', text: '⚠️ 혼자서 연속 7번 발언했습니다. 3초간 대화가 금지됩니다.' });
    }

    const cleanText = filterProfanity(data.text);
    if (roomData.type === 'multi') {
      roomData.history.push(`${socket.userAlias}: ${cleanText}`);
      socket.to(data.room).emit('receive_message', { sender: socket.userAlias, text: cleanText });
    } else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: cleanText }); 
      const aiReply = (await getGoogleAIResponse(getPersonaPrompt(roomData.topic, false, socket.aiPartnerRole), roomData.history.slice(-8), 300)).replace(/^.*?:/, '').trim();
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      
      userStats.count = 0; // AI 답변 시 카운트 초기화
      rateLimits.set(socket.id + '_stats', userStats);
      socket.emit('receive_message', { sender: socket.aiPartnerRole, text: aiReply });
    }
  });

  socket.on('report_user', async (data) => {
    try { await Blacklist.create({ reporterId: data.reporterId, roomName: data.room, reason: data.reason }); } catch (err) {}
  });

  socket.on('request_ai_help', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;
    const aiMessage = await getGoogleAIResponse(`당신은 대화 중재자입니다. 10초간 정적이 흘렀습니다. 대화를 유도하는 50자 이내의 질문을 던지세요.`, roomData.history.slice(-5).map(msg => ({ role: 'user', content: msg })), 300); 
    if (!aiMessage.includes("불안정하여")) io.to(data.room).emit('receive_message', { sender: 'AI 가이드 💡', text: aiMessage });
  });

  // ★ 시라노 귓속말 AI
  socket.on('request_cyrano_help', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;
    const prompt = `대화 코치 '시라노'입니다. 지금까지 대화 흐름을 읽고, 유저가 보낼 짧은 답변 후보 3가지를 추천하세요.\n조건: 1번 논리/팩트, 2번 공감, 3번 위트. 15자 이내.\n출력형식: [논리] 내용 | [공감] 내용 | [위트] 내용`;
    const aiMessage = await getGoogleAIResponse(prompt, roomData.history.slice(-6).map(msg => ({ role: 'user', content: msg })), 150);
    io.to(socket.id).emit('receive_cyrano_help', { suggestions: aiMessage });
  });

  // ★ MBTI 블라인드 추리 저장
  socket.on('submit_mbti_guess', (data) => {
    const roomData = activeRooms[data.room];
    const evt = getCurrentEvent();
    if (roomData && evt && roomData.topic === evt.topic) roomData.mbtiGuesses[socket.userAlias] = data.guess;
  });

  socket.on('request_chemistry_report', (data) => {
    const uid = extractId(data.userId);
    if (activeRooms[data.room] && uid) activeRooms[data.room].userIds.add(uid);
  });

  socket.on('request_my_records', async (data) => {
    try {
      const uid = extractId(data);
      if (uid) socket.emit('receive_my_records', await Report.find({ userIds: uid }).sort({ createdAt: -1 }).limit(20));
    } catch (err) {}
  });

  socket.on('vote_extend', (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;
    if (!roomVotes[data.room]) roomVotes[data.room] = new Set();
    roomVotes[data.room].add(socket.id);

    if (roomVotes[data.room].size === roomData.participants) {
      roomData.extensionCount++; roomData.endTime += (120 * 1000); 
      io.to(data.room).emit('time_extended', { addedTime: 120, currentExtensions: roomData.extensionCount });
      roomVotes[data.room].clear();
    } else {
      socket.to(data.room).emit('partner_wants_extension', { currentVotes: roomVotes[data.room].size, total: roomData.participants });
    }
  });

  socket.on('leave_room', (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;
    socket.leave(data.room);
    if (roomData.type === 'multi') {
      socket.to(data.room).emit('receive_message', { sender: 'System', text: `${socket.userAlias} 님이 퇴장하셨습니다.` });
      if (--roomData.participants < 2) {
         socket.to(data.room).emit('partner_left');
         delete activeRooms[data.room]; delete roomVotes[data.room];
      }
    } else delete activeRooms[data.room];
  });

  // --- [오픈 광장 로직 (7회 도배 뮤트 적용)] ---
  socket.on('join_lounge', async (data) => {
    socket.join('open_lounge');
    const uid = extractId(data?.userId || data);
    if (uid) {
      const user = await User.findOne({ userId: uid });
      socket.loungeNickname = user ? user.nickname : '익명의 소통러';
    }
    socket.emit('init_lounge', openLoungeHistory);
    io.to('open_lounge').emit('lounge_meta', { userCount: io.sockets.adapter.rooms.get('open_lounge')?.size || 1 });
  });

  socket.on('leave_lounge', () => {
    socket.leave('open_lounge');
    io.to('open_lounge').emit('lounge_meta', { userCount: io.sockets.adapter.rooms.get('open_lounge')?.size || 0 });
  });

  socket.on('send_lounge_message', async (data) => {
    const uid = extractId(data.userId);
    if (!uid || !data.text) return;
    
    const now = Date.now();
    if (now < (rateLimits.get(socket.id + '_mute') || 0)) return;

    const userStats = rateLimits.get(socket.id + '_stats') || { sender: null, count: 0 };
    if (userStats.sender === uid) userStats.count++;
    else { userStats.sender = uid; userStats.count = 1; }
    rateLimits.set(socket.id + '_stats', userStats);

    if (userStats.count >= 7) {
      rateLimits.set(socket.id + '_mute', now + 3000);
      userStats.count = 0;
      return; 
    }

    let nickname = '익명의 소통러';
    try { const user = await User.findOne({ userId: uid }); if (user) nickname = user.nickname; } catch (err) {}
    
    const msg = { senderId: uid, nickname, text: filterProfanity(data.text), timestamp: Date.now(), type: 'user', tier: data.tier || 'Unranked' };
    openLoungeHistory.push(msg);
    if (openLoungeHistory.length > 100) openLoungeHistory.shift();
    io.to('open_lounge').emit('new_lounge_message', msg);
  });

  // --- [관전 모드] ---
  socket.on('request_live_rooms', () => {
    const liveRooms = [];
    for (const room in activeRooms) {
      if (activeRooms[room].type === 'multi') liveRooms.push({ roomId: room, topic: activeRooms[room].topic, roleA: activeRooms[room].roleA || 'A', roleB: activeRooms[room].roleB || 'B', spectatorCount: activeRooms[room].spectators ? activeRooms[room].spectators.size : 0 });
    }
    socket.emit('receive_live_rooms', liveRooms);
  });

  socket.on('join_as_spectator', (data) => {
    const roomData = activeRooms[data.roomId];
    if (roomData && roomData.type === 'multi') {
      socket.join(data.roomId);
      if (!roomData.spectators) roomData.spectators = new Set();
      roomData.spectators.add(socket.id);
      socket.spectatingRoom = data.roomId;
      socket.emit('spectator_joined', { history: roomData.history, topic: roomData.topic, roleA: roomData.roleA, roleB: roomData.roleB, spectatorCount: roomData.spectators.size, votesA: roomData.votesA || 0, votesB: roomData.votesB || 0 });
      io.to(data.roomId).emit('spectator_count_update', { count: roomData.spectators.size });
    }
  });

  socket.on('spectator_vote', (data) => {
    const roomData = activeRooms[data.roomId];
    if (roomData && roomData.type === 'multi') {
      data.voteFor === 'A' ? roomData.votesA++ : roomData.votesB++;
      io.to(data.roomId).emit('vote_update', { votesA: roomData.votesA, votesB: roomData.votesB });
    }
  });

  socket.on('leave_spectator', (data) => {
    const roomData = activeRooms[data.roomId];
    if (roomData) {
      socket.leave(data.roomId);
      if (roomData.spectators) {
        roomData.spectators.delete(socket.id);
        io.to(data.roomId).emit('spectator_count_update', { count: roomData.spectators.size });
      }
    }
    socket.spectatingRoom = null;
  });

  socket.on('disconnect', () => {
    if (socket.loungeNickname) io.to('open_lounge').emit('lounge_meta', { userCount: Math.max(0, (io.sockets.adapter.rooms.get('open_lounge')?.size || 1) - 1) });
    if (socket.queueTopic && waitingQueues[socket.queueTopic]) {
      const targetQueue = socket.queueRole === 'A' ? 'roleA' : socket.queueRole === 'B' ? 'roleB' : 'random';
      waitingQueues[socket.queueTopic][targetQueue] = waitingQueues[socket.queueTopic][targetQueue].filter(s => s.id !== socket.id);
    }
    if (socket.spectatingRoom && activeRooms[socket.spectatingRoom]) {
      activeRooms[socket.spectatingRoom].spectators.delete(socket.id);
      io.to(socket.spectatingRoom).emit('spectator_count_update', { count: activeRooms[socket.spectatingRoom].spectators.size });
    }
    if (socket.roomName && activeRooms[socket.roomName] && !socket.spectatingRoom) {
      socket.to(socket.roomName).emit('receive_message', { sender: 'System', text: `⚠️ 상대방의 연결이 불안정합니다. (10초 대기 중...)` });
      setTimeout(() => {
        if (activeRooms[socket.roomName]) {
          io.to(socket.roomName).emit('partner_left');
          delete activeRooms[socket.roomName];
          delete roomVotes[socket.roomName];
        }
      }, 10000);
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

      // ★ 동적 이벤트 스코어 누적
      const activeEvent = getCurrentEvent();
      if (activeEvent && roomData.topic === activeEvent.topic) {
        const votesA = roomData.votesA || 0, votesB = roomData.votesB || 0;
        if (votesA > votesB) globalScoreT += 10;
        else if (votesB > votesA) globalScoreF += 10;
        else { globalScoreT += 5; globalScoreF += 5; } 
        io.emit('faction_score_update', { T: globalScoreT, F: globalScoreF, currentEvent: activeEvent });
      }

      if (roomData.history.length < 4) {
        io.to(room).emit('receive_report', { error: true });
        continue;
      }
      
      let systemPrompt = getPersonaPrompt(roomData.topic, true);

      // ★ MBTI 추리 결과 AI 프롬프트에 주입
      if (activeEvent && roomData.topic === activeEvent.topic && Object.keys(roomData.mbtiGuesses).length > 0) {
        systemPrompt += `\n\n[추가 미션 정보]: 이 대화는 서로의 성향을 숨긴 블라인드 추리 대화였습니다. 각 참여자가 추측한 데이터는 다음과 같습니다: ${JSON.stringify(roomData.mbtiGuesses)}. 이를 바탕으로 두 사람의 실제 성향이 겉으로 어떻게 드러났는지 분석 결과를 한줄평에 위트있게 포함해주세요.`;
      }

      const conversationText = roomData.type === 'single' ? roomData.history.map(msg => `${msg.role === 'user' ? '나' : '상대방'}: ${msg.content}`).join('\n') : roomData.history.join('\n');
      const reportContent = await getGoogleAIResponse(systemPrompt, [{ role: 'user', content: conversationText }], 300); 
      
      let logicScore = 50, linguisticsScore = 50, empathyScore = 50;
      if (reportContent.match(/\[LOGIC:\s*(\d+)\]/i)) logicScore = parseInt(reportContent.match(/\[LOGIC:\s*(\d+)\]/i)[1]);
      if (reportContent.match(/\[LINGUISTICS:\s*(\d+)\]/i)) linguisticsScore = parseInt(reportContent.match(/\[LINGUISTICS:\s*(\d+)\]/i)[1]);
      if (reportContent.match(/\[EMPATHY:\s*(\d+)\]/i)) empathyScore = parseInt(reportContent.match(/\[EMPATHY:\s*(\d+)\]/i)[1]);
      
      const cleanReportText = reportContent.replace(/\[LOGIC:.*\]|\[LINGUISTICS:.*\]|\[EMPATHY:.*\]/gi, '').trim();

      try {
        if (!reportContent.includes("불안정하여")) {
          await Report.create({
            roomName: room, userIds: Array.from(roomData.userIds), type: roomData.type, topic: roomData.topic, participants: roomData.participants, 
            fullLog: roomData.type === 'single' ? roomData.history.map(m => m.content) : roomData.history,
            aiReport: cleanReportText, stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore }
          });
        }
      } catch (dbError) {}

      if (reportContent.includes("불안정하여")) io.to(room).emit('receive_report', { error: true });
      else io.to(room).emit('receive_report', { reportText: cleanReportText, stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore }, partnerId: Array.from(roomData.userIds).find(id => id !== null) });
    }
  }
}, 1000);

setInterval(() => {
  const now = Date.now();
  for (const room in activeRooms) {
    if (now > activeRooms[room].endTime + 600000) { 
      delete activeRooms[room]; delete roomVotes[room];
    }
  }
  for (const topic in waitingQueues) {
    ['roleA', 'roleB', 'random'].forEach(q => waitingQueues[topic][q] = waitingQueues[topic][q].filter(s => s.socket.connected));
  }
  rateLimits.clear(); 
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 WE US 서버 구동 완료 (포트: ${PORT})`));