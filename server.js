require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');

// ★ 푸시 알림 발송을 위한 fetch 추가
const fetch = require('node-fetch');

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

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  nickname: { type: String, default: '익명의 소통러' },
  friends: [{ type: String }],
  pushToken: { type: String, default: '' },
  blockedUsers: [{ type: String }],
  totalChats: { type: Number, default: 0 },
  totalChatTime: { type: Number, default: 0 }, // in minutes
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

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
const openLoungeHistory = []; 

// ★ 7회 도배 3초 뮤트 처리를 위한 맵
const rateLimits = new Map();

let globalScoreT = 0;
let globalScoreF = 0;

// ★ 신규: 닉네임 유령 계정([object Object]) 생성 방지를 위한 절대 필터 함수
function extractId(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.userId || String(val);
  return String(val);
}

// ★ 신규: 뻔하지 않은 참신한 매일매일 스페셜 도파민 큐 데이터
const DAILY_EVENTS = {
  1: {
    topic: "⏰ 지각 변명 대회",
    desc: "월요일 한정 큐! 기상천외한 변명으로 살아남으세요.",
    roleA: "프로 지각러",
    roleB: "깐깐한 보스",
    missionA: "당신은 지각생입니다. 외계인 납치 등 상상 초월의 변명으로 위기를 모면하세요.",
    missionB: "당신은 보스입니다. 상대의 허무맹랑한 변명을 팩트로 찌르고 논리적으로 박살내세요.",
    aiPrompt: "말도 안 되는 지각 변명과 이를 논리적으로 반박하는 티키타카를 하세요."
  },
  2: {
    topic: "🦐 환장할 새우 논쟁",
    desc: "화요일 한정 큐! 내 애인이 절친의 새우를 까준다면?",
    roleA: "대수롭지 않은 쿨병러",
    roleB: "극대노 유교인",
    missionA: "당신은 새우 까주기쯤은 아무렇지 않은 쿨병러입니다. 상대방의 질투를 촌스럽다고 매도하세요.",
    missionB: "당신은 극대노한 유교인입니다. 새우를 까주는 건 플러팅이라며 쿨병러 상대를 맹비난하세요.",
    aiPrompt: "이성 친구와의 스킨십 허용 범위를 두고 격렬하게 논쟁하세요."
  },
  3: {
    topic: "💰 로또 100억 당첨",
    desc: "수요일 한정 큐! 100억 당첨금을 숨길 것인가, 알릴 것인가?",
    roleA: "무덤까지 비밀 은둔자",
    roleB: "당일 퇴사 관종",
    missionA: "당신은 100억 당첨 사실을 가족에게도 숨기는 은둔자입니다. 돈 빌려달라는 연락이 올까 봐 두렵다고 주장하세요.",
    missionB: "당신은 당첨되자마자 퇴사하고 람보르기니를 사는 관종입니다. 돈은 쓰려고 버는 거라며 상대를 답답해하세요.",
    aiPrompt: "갑자기 생긴 거액의 돈을 쓰는 방식에 대해 극명한 시각 차이를 보이세요."
  },
  4: {
    topic: "🧟 좀비 아포칼립스",
    desc: "목요일 한정 큐! 좀비 사태 발생 시 당신의 생존 전략은?",
    roleA: "식량 확보 (이마트파)",
    roleB: "무기 확보 (철물점파)",
    missionA: "당신은 생존의 핵심이 식량이라 믿습니다. 무기보다 통조림이 우선이라며 상대를 설득하세요.",
    missionB: "당신은 생존의 핵심이 무기라 믿습니다. 좀비를 못 죽이면 식량도 뺏긴다며 상대를 비웃으세요.",
    aiPrompt: "극한의 재난 상황에서 생존 우선순위를 두고 논리적으로 대립하세요."
  },
  5: {
    topic: "🏠 불금 약속 파토",
    desc: "금요일 한정 큐! 불금에 갑자기 나가기 귀찮아졌다면?",
    roleA: "파토내는 집순이/돌이",
    roleB: "기어코 끌고가는 인싸",
    missionA: "당신은 오늘따라 집 밖으로 나가기 너무 귀찮습니다. 온갖 핑계를 대며 약속을 취소하려 하세요.",
    missionB: "당신은 오늘 무조건 놀아야 하는 인싸입니다. 핑계 대는 상대를 어떻게든 집 밖으로 끌어내세요.",
    aiPrompt: "불금의 외출을 두고 끊임없는 창과 방패의 대결을 펼치세요."
  },
  6: {
    topic: "✈️ 환장의 여행 메이트",
    desc: "주말 한정 큐! 여행 계획 스타일로 벌어지는 대환장 파티",
    roleA: "분단위 엑셀러 (극J)",
    roleB: "발길 닿는 대로 (극P)",
    missionA: "당신은 여행의 모든 동선을 엑셀로 짜야 직성이 풀리는 J입니다. 무계획인 상대를 한심하게 여기세요.",
    missionB: "당신은 여행은 발길 닿는 대로 가는 것이라 믿는 P입니다. 엑셀 일정표를 들이미는 상대를 숨막혀 하세요.",
    aiPrompt: "여행 계획과 즉흥성을 두고 가치관 차이로 격렬하게 논쟁하세요."
  },
  0: {
    topic: "✈️ 환장의 여행 메이트",
    desc: "주말 한정 큐! 여행 계획 스타일로 벌어지는 대환장 파티",
    roleA: "분단위 엑셀러 (극J)",
    roleB: "발길 닿는 대로 (극P)",
    missionA: "당신은 여행의 모든 동선을 엑셀로 짜야 직성이 풀리는 J입니다. 무계획인 상대를 한심하게 여기세요.",
    missionB: "당신은 여행은 발길 닿는 대로 가는 것이라 믿는 P입니다. 엑셀 일정표를 들이미는 상대를 숨막혀 하세요.",
    aiPrompt: "여행 계획과 즉흥성을 두고 가치관 차이로 격렬하게 논쟁하세요."
  }
};

// ★ 신규: 오늘 요일에 맞는 이벤트 리턴 함수
function getCurrentEvent() {
  return DAILY_EVENTS[new Date().getDay()];
}

async function getGoogleAIResponse(systemPrompt, history, maxTokens = 200) {
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemma-3-12b",
    "gemma-3-4b"
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

  const MODEL_TIMEOUT_MS = 15000;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { maxOutputTokens: maxTokens }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${modelName}`)), MODEL_TIMEOUT_MS)
      );

      const result = await Promise.race([
        model.generateContent({ contents }),
        timeoutPromise
      ]);

      const responseText = result.response.text();
      if (responseText && responseText.trim()) {
        return responseText.trim();
      }
    } catch (error) {
      console.error(`🚨 [AI 오류] ${modelName} 통신 실패:`, error.message);
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

const AI_CONVERSATION_SYSTEM_PROMPT = "You are a natural, witty human user in a 3-minute anonymous chat app. Match the mood (casual, deep, or roleplay). CRITICAL: You must respond in exactly 1 or 2 fully completed sentences. Do not truncate mid-sentence. Be engaging and avoid repetitive AI-like phrasing.";

function getPersonaPrompt(topic, isReport = false, partnerRole = '') {
  if (isReport) {
    return `대화 기록을 분석하여 다음 딱 2가지만 아주 짧게 작성하세요. 부가 설명 절대 금지.
1. [한줄평]: 대화에 대한 팩트폭력 한줄평 (50자 이내)
2. [점수]: 답변 맨 마지막 줄에 다음 형식으로 참여자의 평균을 평가해 주세요: [LOGIC: 0~100] [LINGUISTICS: 0~100] [EMPATHY: 0~100]`;
  }

  // ★ 변경점: 역할 undefined 방어 및 '익명' 치환
  const pRole = (!partnerRole || partnerRole === 'undefined') ? '익명' : partnerRole;

  const baseConstraint = `\n\n[절대 규칙]: 절대 상대방을 비하하거나 모욕적인 도발을 하지 마세요. 예의를 갖추되 역할에 몰입하세요. 대답할 때 당신의 이름표(예: "${pRole}:")를 텍스트 맨 앞에 절대 붙이지 마세요. 반드시 1~2문장 이내(최대 50자 내외)로 자연스럽게 마침표로 끝나는 완성된 문장만 출력하세요. 말이 중간에 끊기면 안 됩니다.`;

  const activeEvent = getCurrentEvent();
  if (activeEvent && topic === activeEvent.topic) {
    return `당신은 '${pRole}' 입장에서 토론합니다. ` + activeEvent.aiPrompt + baseConstraint;
  }

  switch(topic) {
    case '진상손님 방어전':
      return `당신은 '${pRole}' 역할을 맡았습니다. 진상 손님이라면 까다롭고 집요하게 환불이나 서비스를 요구하세요. 알바생이라면 매뉴얼에 따라 단호하지만 정중하게 방어하세요.` + baseConstraint;
    case '압박 면접':
      return `당신은 '${pRole}' 역할을 맡았습니다. 면접관이라면 지원자의 논리적 허점을 파고드는 정중하고 예리한 꼬리질문을 하세요. 지원자라면 긴장하지 않고 본인의 논리를 차분히 어필하세요.` + baseConstraint;
    case '100억 받기 VS 무병장수':
      return `당신은 '${pRole}' 입장에서 토론합니다. 상대의 의견에 정중하게 반박하고 당신의 선택이 가진 가치를 논리적으로 설득하세요.` + baseConstraint;
    default:
      // ★ 변경점: 스몰토크용 부드러운 프롬프트로 수정
      return `당신은 '${pRole}' 역할을 맡은 대화 파트너입니다. 일상속에서 가볍게 웃고 떠들 수 있을만한 주제로 이야기해보세요.` + baseConstraint;
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
      endTime: Date.now() + (180 * 1000),
      roleA: role1,
      roleB: role2,
      spectators: new Set(),
      votesA: 0,
      votesB: 0,
      // ★ 신규: 7회 도배 방지용 카운터
      lastSender: null,
      consecutiveCount: 0
    };

    user1.socket.join(roomName);
    user2.socket.join(roomName);

    user1.socket.userAlias = role1;
    user2.socket.userAlias = role2;
    user1.socket.roomName = roomName;
    user2.socket.roomName = roomName;
    user1.socket.inQueue = false;
    user2.socket.inQueue = false;
    user1.socket.currentRoom = roomName;
    user2.socket.currentRoom = roomName;

    // Clear AI fallback timers immediately before emitting match
    if (user1.socket.aiFallbackTimeout) { clearTimeout(user1.socket.aiFallbackTimeout); user1.socket.aiFallbackTimeout = null; }
    if (user2.socket.aiFallbackTimeout) { clearTimeout(user2.socket.aiFallbackTimeout); user2.socket.aiFallbackTimeout = null; }

    io.to(user1.id).emit('matched', { roomName, partner: role2, myRole: role1, participantCount: 2, endTime: activeRooms[roomName].endTime });
    io.to(user2.id).emit('matched', { roomName, partner: role1, myRole: role2, participantCount: 2, endTime: activeRooms[roomName].endTime });
    user1.socket.emit('matched_human');
    user2.socket.emit('matched_human');

    console.log(`✅ [매칭 성공] ${roomName} 생성 (${role1} vs ${role2})`);
  };

  // ★ 변경점: 큐 매칭 시 역할이 없으면 '익명'으로 처리
  const rA = q.roleA_name || '익명';
  const rB = q.roleB_name || '익명';

  if (q.roleA.length > 0 && q.roleB.length > 0) {
    createRoom(q.roleA.shift(), q.roleB.shift(), rA, rB);
  } else if (q.roleA.length > 0 && q.random.length > 0) {
    createRoom(q.roleA.shift(), q.random.shift(), rA, rB);
  } else if (q.roleB.length > 0 && q.random.length > 0) {
    createRoom(q.random.shift(), q.roleB.shift(), rA, rB);
  } else if (q.random.length > 1) {
    createRoom(q.random.shift(), q.random.shift(), rA, rB);
  }
}

// ==========================================
// 소켓 통신 처리
// ==========================================

io.on('connection', (socket) => {

  // 데일리 이벤트 정보를 전송
  socket.emit('faction_score_update', { 
    T: globalScoreT, 
    F: globalScoreF, 
    currentEvent: getCurrentEvent() 
  });

  socket.on('recover_account_by_token', async (token, callback) => {
    try {
      if (!token) return callback(null);
      const user = await User.findOne({ pushToken: token });
      if (user && typeof callback === 'function') {
        callback(user.userId);
      } else if (typeof callback === 'function') {
        callback(null);
      }
    } catch (e) {
      if(typeof callback === 'function') callback(null);
    }
  });

  socket.on('register_push_token', async (data) => {
    try {
      const uid = extractId(data.userId || data);
      const token = data.token;
      if (!uid || !token) return;
      
      // ★ 닉네임 버그 박멸: $set으로 안전하게 업데이트
      await User.updateOne({ userId: uid }, { $set: { pushToken: token } }, { upsert: true });
      console.log(`📡 [푸시 토큰 등록 완료] ${uid}`);
    } catch (err) {
      console.error("❌ [푸시 토큰 등록 에러]:", err);
    }
  });

  socket.on('get_profile', async (data) => {
    try {
      const uid = extractId(data);
      if (!uid) return;
      
      // ★ 닉네임 버그 박멸: 최초 생성 시에만 $setOnInsert 사용
      await User.updateOne(
        { userId: uid },
        { $setOnInsert: { nickname: '익명의 소통러', friends: [], blockedUsers: [] } },
        { upsert: true }
      );
      
      const user = await User.findOne({ userId: uid });
      const friendsData = await User.find({ userId: { $in: user.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: user.nickname, friends: friendsData });
    } catch (err) {
      console.error("❌ [get_profile 에러]:", err);
    }
  });

  socket.on('update_nickname', async (data) => {
    try {
      const uid = extractId(data.userId);
      const nickname = data.nickname;
      if (!uid || !nickname) return;
      
      // ★ 닉네임 버그 박멸: $set을 강제하여 닉네임 덮어쓰기 고정
      await User.updateOne(
        { userId: uid },
        { $set: { nickname: nickname } },
        { upsert: true }
      );

      socket.loungeNickname = nickname; 

      const finalUser = await User.findOne({ userId: uid });
      const friendsData = await User.find({ userId: { $in: finalUser.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: finalUser.nickname, friends: friendsData });
      console.log(`✅ [닉네임 변경 고정 완료] ${uid} -> ${finalUser.nickname}`);
    } catch (err) {
      console.error("❌ [닉네임 변경 에러]:", err);
    }
  });

  socket.on('add_friend', async (data) => {
    try {
      const uid = extractId(data.userId);
      const friendId = data.friendId;
      if (!uid || !friendId) return;
      if (uid === friendId) return;

      const friendExists = await User.findOne({ userId: friendId });
      if (!friendExists) return;

      await User.updateOne(
        { userId: uid },
        { $addToSet: { friends: friendId } }
      );

      const updatedUser = await User.findOne({ userId: uid });
      const friendsData = await User.find({ userId: { $in: updatedUser.friends } }).select('userId nickname');
      socket.emit('receive_profile', { nickname: updatedUser.nickname, friends: friendsData });
    } catch (err) {
      console.error("❌ [친구 추가 에러]:", err);
    }
  });

  socket.on('get_dms', async (data) => {
    try {
      const uid = extractId(data.userId);
      const friendId = data.friendId;
      if (!uid || !friendId) return;
      const dms = await DM.find({
        $or: [
          { senderId: uid, receiverId: friendId },
          { senderId: friendId, receiverId: uid }
        ]
      }).sort({ createdAt: 1 });
      socket.emit('receive_dms', dms);
    } catch (err) {
      console.error("❌ [DM 불러오기 에러]:", err);
    }
  });

  socket.on('send_dm', async (data) => {
    try {
      const senderId = extractId(data.senderId);
      const receiverId = data.receiverId;
      const text = data.text;
      if (!senderId || !receiverId || !text) return;

      const receiver = await User.findOne({ userId: receiverId });
      if (receiver && receiver.blockedUsers && receiver.blockedUsers.includes(senderId)) return;

      const cleanText = filterProfanity(text);
      const newMsg = await DM.create({ senderId: senderId, receiverId: receiverId, text: cleanText });
      
      io.emit('new_dm_arrived', newMsg);

      const sender = await User.findOne({ userId: senderId });

      if (receiver && receiver.pushToken) {
        const senderName = sender ? sender.nickname : '익명';
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: receiver.pushToken,
            sound: 'default',
            title: `💬 WE US - ${senderName}님의 쪽지`,
            body: cleanText,
            data: { screen: 'profile', senderId: senderId }, 
          }),
        });
      }
    } catch (err) {
      console.error("❌ [DM 전송 에러]:", err);
    }
  });

  socket.on('block_user', async (data) => {
    try {
      const uid = extractId(data.userId);
      const { room } = data;
      if (!uid || !room) return;
      const roomData = activeRooms[room];
      if (!roomData) return;

      let partnerId = null;
      for (let id of roomData.userIds) {
        if (id !== uid && id !== null) {
          partnerId = id;
          break;
        }
      }

      if (partnerId) {
        const user = await User.findOne({ userId: uid });
        if (user && !user.blockedUsers.includes(partnerId)) {
          user.blockedUsers.push(partnerId);
          await user.save();
        }
      }
    } catch (err) {
      console.error("❌ [차단 에러]:", err);
    }
  });

  socket.on('join_queue', (data) => {
    // Spam guard: reject if already queued or has a pending fallback timer
    if (socket.queueTopic || socket.aiFallbackTimeout) return;

    const uid = extractId(data.userId);
    const { topic, role, roleA_name, roleB_name } = data;
    if (!uid) return;
    socket.userId = uid;

    if (!waitingQueues[topic]) {
      waitingQueues[topic] = { roleA: [], roleB: [], random: [], roleA_name, roleB_name };
    }

    const queueData = { id: socket.id, socket: socket, userId: uid };

    if (role === 'A') waitingQueues[topic].roleA.push(queueData);
    else if (role === 'B') waitingQueues[topic].roleB.push(queueData);
    else waitingQueues[topic].random.push(queueData);

    socket.queueTopic = topic;
    socket.queueRole = role || 'random';
    socket.inQueue = true;
    socket.currentRoom = null;

    console.log(`⏳ [대기열 진입] 유저: ${socket.id} | 주제: ${topic} | 역할: ${role}`);
    tryMatch(topic);

    // 10-second AI fallback: if still in queue, auto-match with AI bot
    socket.aiFallbackTimeout = setTimeout(() => {
      socket.aiFallbackTimeout = null;
      if (!socket.queueTopic) return; // already matched or left

      // Fail-safe: abort if already in a room or no longer queued
      if (!socket.inQueue || socket.currentRoom) return;

      // Ghost AI room guard: abort if socket already disconnected
      if (!socket.connected) return;

      // Remove from all queues (deep cleanup)
      for (const qKey of ['dailyQueue', 'langQueue', 'deepQueue', 'roleplayQueue']) {
        const q = waitingQueues[qKey];
        if (q) {
          q.roleA = q.roleA.filter(s => s.id !== socket.id);
          q.roleB = q.roleB.filter(s => s.id !== socket.id);
          q.random = q.random.filter(s => s.id !== socket.id);
        }
      }
      if (waitingQueues[topic]) {
        const targetQueue = socket.queueRole === 'A' ? 'roleA' : socket.queueRole === 'B' ? 'roleB' : 'random';
        waitingQueues[topic][targetQueue] = waitingQueues[topic][targetQueue].filter(s => s.id !== socket.id);
      }
      socket.queueTopic = null;
      socket.queueRole = null;

      // Determine roles
      const myRoleName = role === 'A' ? (roleA_name || '역할A') : role === 'B' ? (roleB_name || '역할B') : (roleA_name || '익명');
      const aiRoleName = role === 'A' ? (roleB_name || '역할B') : role === 'B' ? (roleA_name || '역할A') : (roleB_name || 'AI 파트너');

      const roomId = `ai_${socket.id}_${Date.now()}`;
      socket.join(roomId);
      socket.userAlias = myRoleName;
      socket.aiPartnerRole = aiRoleName;
      socket.roomName = roomId;

      activeRooms[roomId] = {
        type: 'single',
        topic: topic,
        history: [],
        isGeneratingReport: false,
        userIds: new Set(uid ? [uid] : []),
        endTime: Date.now() + (180 * 1000),
        lastSender: null,
        consecutiveCount: 0
      };

      socket.emit('matched', {
        roomId: roomId,
        partner: aiRoleName,
        myRole: myRoleName,
        participantCount: 2,
        endTime: activeRooms[roomId].endTime
      });
      socket.emit('receive_message', {
        sender: 'System',
        text: '대기 인원이 적어 AI 파트너와 연결되었습니다. 3분간 자유롭게 대화해보세요!'
      });
      console.log(`🤖 [AI 폴백 매칭] ${socket.id} -> ${roomId}`);
    }, 10000);

    // Cancel fallback if matched with a human before 10s
    socket.once('matched_human', () => {
      if (socket.aiFallbackTimeout) {
        clearTimeout(socket.aiFallbackTimeout);
        socket.aiFallbackTimeout = null;
      }
    });
  });

  socket.on('leave_queue', () => {
    // Clear zombie AI fallback timer
    if (socket.aiFallbackTimeout) {
      clearTimeout(socket.aiFallbackTimeout);
      socket.aiFallbackTimeout = null;
    }
    // Deep cleanup: remove from all queue arrays
    for (const qKey of Object.keys(waitingQueues)) {
      const q = waitingQueues[qKey];
      if (q) {
        q.roleA = q.roleA.filter(s => s.id !== socket.id);
        q.roleB = q.roleB.filter(s => s.id !== socket.id);
        q.random = q.random.filter(s => s.id !== socket.id);
      }
    }
    socket.queueTopic = null;
    socket.queueRole = null;
    // Signal human match so any lingering once('matched_human') listeners fire
    socket.emit('matched_human');
  });

  socket.on('start_ai_chat', (data) => {
    const uid = extractId(data.userId);
    const { topic, myRole, aiRole } = data;
    socket.userId = uid;
    const roomId = `ai_${socket.id}_${Date.now()}`;
    socket.join(roomId);
    
    socket.userAlias = myRole || '익명';
    socket.aiPartnerRole = aiRole || '익명'; 
    
    activeRooms[roomId] = { 
      type: 'single', 
      topic: topic, 
      history: [], 
      isGeneratingReport: false,
      userIds: new Set(uid ? [uid] : []), 
      endTime: Date.now() + (180 * 1000),
      lastSender: null,
      consecutiveCount: 0
    };

    // ★ FIX-1: include endTime for frontend clock sync
    socket.emit('matched', { roomId: roomId, partner: socket.aiPartnerRole, myRole: socket.userAlias, participantCount: 2, endTime: activeRooms[roomId].endTime });
    socket.emit('receive_message', { sender: 'System', text: `[시스템] '${topic}' 모드가 시작되었습니다. 당신은 [${socket.userAlias}]입니다.` });
  });

  socket.on('send_message', async (data) => {
    const now = Date.now();
    
    // ★ 변경점: 0.5초 쿨타임 삭제. 단축 채팅 연속 전송 가능
    const muteUntil = rateLimits.get(socket.id + '_mute') || 0;
    if (now < muteUntil) return;

    const roomData = activeRooms[data.room || data.roomId];
    if (!roomData) return;

    // ★ 신규: 7회 연속 도배 시 3초간 뮤트 로직
    const userStats = rateLimits.get(socket.id + '_stats') || { sender: null, count: 0 };
    if (userStats.sender === socket.userAlias) {
      userStats.count++;
    } else {
      userStats.sender = socket.userAlias;
      userStats.count = 1;
    }
    rateLimits.set(socket.id + '_stats', userStats);

    if (userStats.count >= 7) {
      rateLimits.set(socket.id + '_mute', now + 3000); // 3초 뮤트
      userStats.count = 0;
      socket.emit('receive_message', { sender: 'System', text: '⚠️ 혼자서 연속 7번 발언했습니다. 3초간 대화가 금지됩니다.' });
      return;
    }

    const cleanText = filterProfanity(data.text);

    if (roomData.type === 'multi') {
      roomData.history.push(`${socket.userAlias}: ${cleanText}`);
      socket.to(data.room).emit('receive_message', { sender: socket.userAlias, text: cleanText });
    } 
    else if (roomData.type === 'single') {
      roomData.history.push({ role: 'user', content: cleanText }); 
      
      const systemPrompt = AI_CONVERSATION_SYSTEM_PROMPT + '\n\n' + getPersonaPrompt(roomData.topic, false, socket.aiPartnerRole);
      let aiReply = await getGoogleAIResponse(systemPrompt, roomData.history.slice(-8), 200);
      
      aiReply = aiReply.replace(/^.*?:/, '').trim();
      
      roomData.history.push({ role: 'assistant', content: aiReply }); 
      
      // AI 답변 시 연속 카운트 리셋
      userStats.count = 0;
      rateLimits.set(socket.id + '_stats', userStats);

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
    } catch (err) {}
  });

  socket.on('request_ai_help', async (data) => {
    const roomData = activeRooms[data.room];
    if (!roomData) return;
    
    const chatHistory = data.history.slice(-5).map(msg => ({ role: 'user', content: `${msg.sender}: ${msg.text}` }));
    const systemPrompt = `당신은 정중한 대화 중재자입니다. 10초간 정적이 흘렀습니다. 대화 문맥을 파악해 상대방이 부담 없이 대답할 수 있는 질문을 하나 던져 대화를 부드럽게 유도하세요. 절대 도발하지 말고, 50자 이내의 완성된 한 문장으로 대답하세요.`;
    
    const aiMessage = await getGoogleAIResponse(systemPrompt, chatHistory, 300); 
    
    if (!aiMessage.includes("불안정하여")) {
      io.to(data.room).emit('receive_message', { sender: 'AI 가이드 💡', text: aiMessage });
    }
  });

  socket.on('request_chemistry_report', (data) => {
    const uid = extractId(data.userId);
    const roomData = activeRooms[data.room];
    if (roomData && uid) {
      roomData.userIds.add(uid);
    }
  });

  socket.on('request_my_records', async (data) => {
    try {
      const uid = extractId(data);
      if (!uid) return;
      const [myRecords, userDoc] = await Promise.all([
        Report.find({ userIds: uid }).sort({ createdAt: -1 }).limit(20),
        User.findOne({ userId: uid }, 'totalChats totalChatTime')
      ]);
      socket.emit('receive_my_records', {
        records: myRecords,
        totalChats: userDoc?.totalChats || 0,
        totalChatTime: userDoc?.totalChatTime || 0
      });
    } catch (err) {}
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
      // ★ FIX-1: send updated endTime so clients re-sync their countdown
      io.to(room).emit('time_extended', { addedTime: 120, currentExtensions: roomData.extensionCount, endTime: roomData.endTime });
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

      roomData.participants -= 1;
      if (roomData.participants < 2) {
        socket.to(room).emit('partner_left');
        if (!roomData.isGeneratingReport && Date.now() < roomData.endTime) {
          delete activeRooms[room];
          if (roomVotes[room]) delete roomVotes[room];
        }
      }
    } else {
      delete activeRooms[room];
    }
  });

  socket.on('join_lounge', async (data) => {
    socket.join('open_lounge');
    
    const uid = extractId(data?.userId || data);
    if (!uid) return;

    let nickname = '익명의 소통러';
    try {
      const user = await User.findOne({ userId: uid });
      if (user) nickname = user.nickname;
    } catch(e) {}
    
    socket.loungeNickname = nickname;
    socket.emit('init_lounge', openLoungeHistory);

    const count = io.sockets.adapter.rooms.get('open_lounge')?.size || 1;
    io.to('open_lounge').emit('lounge_meta', { userCount: count });
  });

  socket.on('leave_lounge', () => {
    socket.leave('open_lounge');
    
    const count = io.sockets.adapter.rooms.get('open_lounge')?.size || 0;
    io.to('open_lounge').emit('lounge_meta', { userCount: count });
  });

  socket.on('send_lounge_message', async (data) => {
    const uid = extractId(data.userId);
    if (!uid || !data.text) return;
    
    const now = Date.now();
    
    // ★ 광장에서도 0.5초 제한 삭제 및 7회 뮤트 적용
    const muteUntil = rateLimits.get(socket.id + '_mute') || 0;
    if (now < muteUntil) return;

    const userStats = rateLimits.get(socket.id + '_stats') || { sender: null, count: 0 };
    if (userStats.sender === uid) {
      userStats.count++;
    } else {
      userStats.sender = uid;
      userStats.count = 1;
    }
    rateLimits.set(socket.id + '_stats', userStats);

    if (userStats.count >= 7) {
      rateLimits.set(socket.id + '_mute', now + 3000);
      userStats.count = 0;
      return; 
    }

    let nickname = '익명의 소통러';
    try {
      const user = await User.findOne({ userId: uid });
      if (user) nickname = user.nickname;
    } catch (err) {}
    
    const cleanText = filterProfanity(data.text);
    const msg = { 
      senderId: uid, 
      nickname: nickname, 
      text: cleanText, 
      timestamp: Date.now(), 
      type: 'user',
      tier: data.tier || 'Unranked'
    };
    
    openLoungeHistory.push(msg);
    if (openLoungeHistory.length > 100) openLoungeHistory.shift();
    
    io.to('open_lounge').emit('new_lounge_message', msg);
  });

  socket.on('request_live_rooms', () => {
    const liveRooms = [];
    for (const room in activeRooms) {
      const r = activeRooms[room];
      if (r.type === 'multi') {
        liveRooms.push({
          roomId: room,
          topic: r.topic,
          roleA: r.roleA || 'A',
          roleB: r.roleB || 'B',
          spectatorCount: r.spectators ? r.spectators.size : 0
        });
      }
    }
    socket.emit('receive_live_rooms', liveRooms);
  });

  socket.on('join_as_spectator', (data) => {
    const { roomId } = data;
    const roomData = activeRooms[roomId];
    if (roomData && roomData.type === 'multi') {
      socket.join(roomId);
      if (!roomData.spectators) roomData.spectators = new Set();
      roomData.spectators.add(socket.id);
      socket.spectatingRoom = roomId;

      socket.emit('spectator_joined', {
        history: roomData.history,
        topic: roomData.topic,
        roleA: roomData.roleA,
        roleB: roomData.roleB,
        spectatorCount: roomData.spectators.size,
        votesA: roomData.votesA || 0,
        votesB: roomData.votesB || 0
      });
      io.to(roomId).emit('spectator_count_update', { count: roomData.spectators.size });
    }
  });

  socket.on('spectator_vote', (data) => {
    const { roomId, voteFor } = data; 
    const roomData = activeRooms[roomId];
    
    if (roomData && roomData.type === 'multi') {
      if (voteFor === 'A') roomData.votesA = (roomData.votesA || 0) + 1;
      else if (voteFor === 'B') roomData.votesB = (roomData.votesB || 0) + 1;

      io.to(roomId).emit('vote_update', { votesA: roomData.votesA, votesB: roomData.votesB });
    }
  });

  socket.on('leave_spectator', (data) => {
    const { roomId } = data;
    const roomData = activeRooms[roomId];
    if (roomData) {
      socket.leave(roomId);
      if (roomData.spectators) {
        roomData.spectators.delete(socket.id);
        io.to(roomId).emit('spectator_count_update', { count: roomData.spectators.size });
      }
    }
    socket.spectatingRoom = null;
  });

  socket.on('disconnect', () => {
    // Clear zombie AI fallback timer
    if (socket.aiFallbackTimeout) {
      clearTimeout(socket.aiFallbackTimeout);
      socket.aiFallbackTimeout = null;
    }

    if (socket.loungeNickname) {
      const count = (io.sockets.adapter.rooms.get('open_lounge')?.size || 1) - 1;
      io.to('open_lounge').emit('lounge_meta', { userCount: Math.max(0, count) });
    }

    // Deep cleanup: remove from all queue arrays
    for (const qKey of Object.keys(waitingQueues)) {
      const q = waitingQueues[qKey];
      if (q) {
        q.roleA = q.roleA.filter(s => s.id !== socket.id);
        q.roleB = q.roleB.filter(s => s.id !== socket.id);
        q.random = q.random.filter(s => s.id !== socket.id);
      }
    }
    socket.queueTopic = null;
    socket.queueRole = null;

    if (socket.spectatingRoom && activeRooms[socket.spectatingRoom]) {
      const roomData = activeRooms[socket.spectatingRoom];
      if (roomData.spectators) {
        roomData.spectators.delete(socket.id);
        io.to(socket.spectatingRoom).emit('spectator_count_update', { count: roomData.spectators.size });
      }
    }

    if (socket.roomName && activeRooms[socket.roomName] && !socket.spectatingRoom) {
      const room = socket.roomName;
      socket.to(room).emit('receive_message', { sender: 'System', text: `⚠️ 상대방의 연결이 불안정합니다. (10초 대기 중...)` });
      
      setTimeout(() => {
        // ★ FIX-4: room may already be deleted by the report interval if the
        //   disconnect happened right at endTime. Guard is already here — safe.
        if (activeRooms[room]) {
          io.to(room).emit('partner_left');
          delete activeRooms[room];
          if (roomVotes[room]) delete roomVotes[room];
        }
      }, 10000);
    }
  });
});

// ==========================================
// 서버 타이머: 시간 초과 시 리포트 자동 생성
// ==========================================

setInterval(() => {
  const now = Date.now();
  for (const room in activeRooms) {
    const roomData = activeRooms[room];

    if (now < roomData.endTime || roomData.isGeneratingReport) continue;

    // ★ FIX-2: set the lock immediately and synchronously before any await,
    //   so no second iteration of this interval can enter this branch.
    roomData.isGeneratingReport = true;

    // ★ FIX-4: remove the room from activeRooms right away so that
    //   (a) a concurrent disconnect timeout cannot double-delete,
    //   (b) this interval never visits the room again.
    delete activeRooms[room];
    if (roomVotes[room]) delete roomVotes[room];

    // Run the async report work in a self-contained IIFE so the interval
    // callback itself stays synchronous (avoids unhandled-rejection on throw).
    (async () => {
      try {
        const activeEvent = getCurrentEvent();
        if (activeEvent && roomData.topic === activeEvent.topic) {
          const votesA = roomData.votesA || 0;
          const votesB = roomData.votesB || 0;
          if (votesA > votesB) globalScoreT += 10;
          else if (votesB > votesA) globalScoreF += 10;
          else { globalScoreT += 5; globalScoreF += 5; }

          io.emit('faction_score_update', { T: globalScoreT, F: globalScoreF, currentEvent: activeEvent });
        }

        if (roomData.history.length < 4) {
          io.to(room).emit('receive_report', { error: true });
          return;
        }

        const systemPrompt = getPersonaPrompt(roomData.topic, true);
        const conversationText = roomData.type === 'single'
          ? roomData.history.map(msg => `${msg.role === 'user' ? '나' : '상대방'}: ${msg.content}`).join('\n')
          : roomData.history.join('\n');

        // ★ FIX-3: getGoogleAIResponse can throw (network error, quota, etc.).
        //   Any exception is caught below, which emits an error report instead
        //   of leaving the client stuck on the "Analyzing..." screen forever.
        const reportContent = await getGoogleAIResponse(
          systemPrompt,
          [{ role: 'user', content: conversationText }],
          300
        );

        // Treat the fallback "불안정하여" string as an AI failure
        if (!reportContent || reportContent.includes("불안정하여")) {
          io.to(room).emit('receive_report', { error: true });
          return;
        }

        let logicScore = 50, linguisticsScore = 50, empathyScore = 50;
        const logicMatch      = reportContent.match(/\[LOGIC:\s*(\d+)\]/i);
        const linguisticsMatch = reportContent.match(/\[LINGUISTICS:\s*(\d+)\]/i);
        const empathyMatch    = reportContent.match(/\[EMPATHY:\s*(\d+)\]/i);

        if (logicMatch)       logicScore       = parseInt(logicMatch[1]);
        if (linguisticsMatch) linguisticsScore = parseInt(linguisticsMatch[1]);
        if (empathyMatch)     empathyScore     = parseInt(empathyMatch[1]);

        const cleanReportText = reportContent
          .replace(/\[LOGIC:.*?\]|\[LINGUISTICS:.*?\]|\[EMPATHY:.*?\]/gi, '')
          .trim();

        try {
          await Report.create({
            roomName: room,
            userIds: Array.from(roomData.userIds),
            type: roomData.type,
            topic: roomData.topic,
            participants: roomData.participants,
            fullLog: roomData.type === 'single'
              ? roomData.history.map(m => m.content)
              : roomData.history,
            aiReport: cleanReportText,
            stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore }
          });

          // Increment per-user cumulative stats
          const chatDurationMinutes = Math.max(1, Math.round((Date.now() - (roomData.endTime - 180000)) / 60000));
          const userIds = Array.from(roomData.userIds).filter(id => id && typeof id === 'string' && !id.startsWith('AI_'));
          await Promise.all(
            userIds.map(uid =>
              User.updateOne(
                { userId: uid },
                { $inc: { totalChats: 1, totalChatTime: chatDurationMinutes } },
                { upsert: false }
              )
            )
          );
        } catch (dbError) {
          console.error(`❌ [DB 저장 오류] ${room}:`, dbError.message);
        }

        const userIdArray = Array.from(roomData.userIds).filter(
          id => id && typeof id === 'string' && !id.startsWith('AI_')
        );
        for (const [, socketObj] of io.sockets.sockets) {
          if (socketObj.roomName === room) {
            const myId = socketObj.userId;
            const pId = userIdArray.find(id => id !== myId) || null;
            socketObj.emit('receive_report', {
              reportText: cleanReportText,
              stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore },
              partnerId: pId
            });
          }
        }
        // single mode: emit directly to the room socket
        if (roomData.type === 'single') {
          io.to(room).emit('receive_report', {
            reportText: cleanReportText,
            stats: { logic: logicScore, linguistics: linguisticsScore, empathy: empathyScore },
            partnerId: null
          });
        }

      } catch (err) {
        // ★ FIX-3: top-level catch — any unhandled throw (Gemini crash, parse
        //   error, etc.) still sends an error event so the client is never stuck.
        console.error(`❌ [리포트 생성 실패] ${room}:`, err.message);
        io.to(room).emit('receive_report', { error: true });
      }
    })();
  }
}, 1000);

// ★ 서버 메모리 누수 방지 청소기 (10분 주기)
setInterval(() => {
  const now = Date.now();
  console.log('🧹 [서버 청소] 좀비 방 및 메모리 정리 중...');
  
  for (const room in activeRooms) {
    if (now > activeRooms[room].endTime + 600000) { // 종료 후 10분 지난 방 삭제
      delete activeRooms[room];
      delete roomVotes[room];
    }
  }
  
  for (const topic in waitingQueues) {
    ['roleA', 'roleB', 'random'].forEach(q => {
      waitingQueues[topic][q] = waitingQueues[topic][q].filter(s => s.socket.connected);
    });
  }
  
  rateLimits.clear(); 
}, 10 * 60 * 1000);

// ==========================================
// 로비 실시간 통계 브로드캐스트 (3초 주기)
// ==========================================

const CATEGORY_TOPICS = {
  daily:    ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'],
  deep:     ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'],
  roleplay: ['진상손님 방어전', '압박 면접'],
};

setInterval(() => {
  // 접속자 수
  const totalOnline = io.engine.clientsCount;

  // 카테고리별 대기 인원 (lang은 AI 즉시매칭이므로 0 고정)
  const queueCounts = { daily: 0, lang: 0, deep: 0, roleplay: 0 };
  for (const [cat, topics] of Object.entries(CATEGORY_TOPICS)) {
    for (const topic of topics) {
      const q = waitingQueues[topic];
      if (q) queueCounts[cat] += q.roleA.length + q.roleB.length + q.random.length;
    }
  }

  // 활성 멀티 방 수 및 총 관전자 수
  let activeRoomsCount = 0;
  let totalSpectators = 0;
  for (const roomData of Object.values(activeRooms)) {
    if (roomData.type === 'multi') {
      activeRoomsCount++;
      if (roomData.spectators) totalSpectators += roomData.spectators.size;
    }
  }

  // 오늘의 이벤트 참여자 수 (대기중 + 진행중 방)
  const activeEvent = getCurrentEvent();
  let eventParticipants = 0;
  if (activeEvent) {
    const eq = waitingQueues[activeEvent.topic];
    if (eq) eventParticipants += eq.roleA.length + eq.roleB.length + eq.random.length;
    for (const roomData of Object.values(activeRooms)) {
      if (roomData.topic === activeEvent.topic) eventParticipants += 2;
    }
  }

  io.emit('lobby_stats_update', {
    totalOnline,
    queueCounts,
    activeRoomsCount,
    totalSpectators,
    eventParticipants,
  });
}, 3000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 WE US 서버 구동 완료 (포트: ${PORT})`));