'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import LobbyView from './components/LobbyView';
import RecordView from './components/RecordView';
import ChatRoom from './components/ChatRoom';
import ProfileView from './components/ProfileView';

const SERVER_URL = 'https://we-us-backend.onrender.com';

const ROLE_MAP: Record<string, { roleA: string, roleB: string }> = {
  '100억 받기 VS 무병장수': { roleA: '100억 선택', roleB: '무병장수 선택' },
  '자본주의 생존기': { roleA: '자본주의 찬성론자', roleB: '자본주의 회의론자' },
  '최악의 이불킥 경험': { roleA: '썰 푸는 화자', roleB: '공감하는 리스너' },
  '진상손님 방어전': { roleA: '알바생', roleB: '진상손님' },
  '압박 면접': { roleA: '지원자', roleB: '면접관' }
};

const ROLE_MISSIONS: Record<string, Record<string, string>> = {
  '압박 면접': { '지원자': "당신은 이력서에 '해외 영업 3년'이라 적었지만, 사실 워홀 3개월이 전부입니다. 3분간 방어하세요.", '면접관': "해외 영업 3년이라는데 철저한 거짓말 같습니다. 집요하게 꼬리 질문을 던지세요." },
  '진상손님 방어전': { '알바생': "당신은 카페 알바생입니다. 다 마신 얼음을 가져와 환불을 요구하는 손님을 방어하세요.", '진상손님': "당신은 돈이 아깝습니다. 얼음이 빨리 녹았다는 논리로 전액 환불을 받아내세요." },
  '100억 받기 VS 무병장수': { '100억 선택': "당신은 100억을 선택했습니다. 무병장수를 고른 상대에게 돈 없는 장수는 저주라고 팩트폭행하세요.", '무병장수 선택': "당신은 무병장수를 선택했습니다. 건강을 잃으면 돈은 휴지조각이라고 상대를 압도하세요." }
};

export default function WeUsApp() {
  const [activeTab, setActiveTab] = useState<'lobby' | 'myRecord' | 'profile'>('lobby');
  const [userId, setUserId] = useState<string>('');
  const [myReports, setMyReports] = useState<any[]>([]); 

  const [step, setStep] = useState<'lobby' | 'role_select' | 'waiting' | 'chat'>('lobby');
  const [timeLeft, setTimeLeft] = useState(180); 
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false); 
  const [isSingleMode, setIsSingleMode] = useState(false); 
  
  const [selectedCategory, setSelectedCategory] = useState<string>('daily');
  const [selectedTopic, setSelectedTopic] = useState<string>('가벼운 스몰토크');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [myRole, setMyRole] = useState<string>('');
  const [partnerRole, setPartnerRole] = useState<string>('');

  const [hasVoted, setHasVoted] = useState(false);
  const [voteStatus, setVoteStatus] = useState(''); 
  const [extensionCount, setExtensionCount] = useState(0);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<string | null>(null);
  const [reportStats, setReportStats] = useState<any>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null); 
  
  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);
  const [isConnecting, setIsConnecting] = useState(false); 
  const [isTyping, setIsTyping] = useState(false); 

  const [sysModal, setSysModal] = useState({ isOpen: false, title: '', desc: '', type: 'alert', onConfirm: () => {} });
  const showModal = (title: string, desc: string, type: 'alert' | 'confirm' = 'alert', onConfirm = () => {}) => {
    setSysModal({ isOpen: true, title, desc, type, onConfirm });
  };

  const socketRef = useRef<Socket | null>(null);
  const lastInteractionTime = useRef<number>(Date.now());
  const messagesRef = useRef(messages);
  const stateRefs = useRef({ selectedTopic, isAnalyzing, reportData, showAd });

  useEffect(() => { stateRefs.current = { selectedTopic, isAnalyzing, reportData, showAd }; }, [selectedTopic, isAnalyzing, reportData, showAd]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    let storedId = localStorage.getItem('weus_user_id');
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('weus_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  useEffect(() => {
    if (!userId) return; 
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('receive_my_records', (records) => { setMyReports(records); });

    socketRef.current.on('matched', (data) => {
      setIsConnecting(false); setRoom(data.roomName || data.roomId);
      setMyRole(data.myRole || '나'); setPartnerRole(data.partner || '상대방');
      setStep('chat'); setTimeLeft(180); setHasVoted(false); setVoteStatus(''); setExtensionCount(0); 
      setIsAnalyzing(false); setReportData(null); setReportStats(null); setPartnerId(null); setShowAd(false); setIsTyping(false); 
      
      const missionText = ROLE_MISSIONS[stateRefs.current.selectedTopic]?.[data.myRole] || `당신은 [${data.myRole}] 역할을 배정받았습니다. 대화를 시작해 보세요.`;
      setMessages([{ sender: 'System', text: `🎯 [미션 하달]\n${missionText}` }]);
      lastInteractionTime.current = Date.now();
      if (socketRef.current?.id === data.hostId) setIsHost(true);
    });

    socketRef.current.on('receive_message', (data) => {
      setIsTyping(false); 
      if (data.sender === 'System' && data.text.includes('모드가 시작되었습니다')) return;
      setMessages((prev) => [...prev, { sender: data.sender, text: data.text }]);
      lastInteractionTime.current = Date.now();
    });

    socketRef.current.on('partner_left', () => {
      if (!stateRefs.current.isAnalyzing && !stateRefs.current.reportData && !stateRefs.current.showAd) {
        showModal('대화 종료', '상대방이 방을 나갔습니다.', 'alert', () => setStep('lobby'));
      }
    });

    socketRef.current.on('partner_wants_extension', (data) => {
      setVoteStatus(`(${data.currentVotes}/${data.total}명 동의)`);
      if(data.currentVotes === 1) setMessages((prev) => [...prev, { sender: 'System', text: '누군가 대화 시간 연장을 원합니다! 수락해 주세요.' }]);
    });

    socketRef.current.on('time_extended', (data) => {
      setTimeLeft((prev) => prev + data.addedTime); setHasVoted(false); setVoteStatus(''); setExtensionCount(data.currentExtensions);
      setMessages((prev) => [...prev, { sender: 'System', text: `🎉 2분 연장되었습니다! (남은 기회: ${2 - data.currentExtensions}번)` }]);
    });

    socketRef.current.on('receive_report', (data) => {
      setIsAnalyzing(false);
      if (data.error) showModal("분석 실패", "대화 내용이 너무 짧아 리포트를 발급할 수 없습니다.", "alert");
      else { 
        setReportData(data.reportText); 
        setReportStats(data.stats);
        setPartnerId(data.partnerId); 
        if (userId) socketRef.current?.emit('request_my_records', userId); 
      }
    });

    return () => { socketRef.current?.disconnect(); };
  }, [userId]); 

  useEffect(() => {
    const handleAppActive = () => {
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleAppActive();
      }
    });
    
    window.addEventListener('appStateActive', handleAppActive);

    return () => {
      document.removeEventListener('visibilitychange', handleAppActive);
      window.removeEventListener('appStateActive', handleAppActive);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'myRecord' && userId) socketRef.current?.emit('request_my_records', userId);
  }, [activeTab, userId]);

  useEffect(() => {
    if (step !== 'chat' || timeLeft <= 0 || isAnalyzing || reportData || showAd) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer); 
          setIsAnalyzing(true); 
          setTimeout(() => {
            if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
              (window as any).ReactNativeWebView.postMessage('SHOW_ADMOB_AD');
            }
            setShowAd(true); setAdCountdown(3);      
            socketRef.current?.emit('request_chemistry_report', { room, userId }); 
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft, room, isAnalyzing, reportData, showAd, userId]);

  useEffect(() => {
    if (!showAd || adCountdown <= 0) return;
    const adTimer = setInterval(() => setAdCountdown(p => p - 1), 1000);
    return () => clearInterval(adTimer);
  }, [showAd, adCountdown]);

  useEffect(() => {
    if (step !== 'chat' || isSingleMode) return; 
    const silenceChecker = setInterval(() => {
      if (Date.now() - lastInteractionTime.current > 10000 && isHost) {
        socketRef.current?.emit('request_ai_help', { room, history: messagesRef.current });
        lastInteractionTime.current = Date.now(); 
      }
    }, 1000);
    return () => clearInterval(silenceChecker);
  }, [step, room, isHost, isSingleMode]);

  const forceLeaveRoom = () => {
    socketRef.current?.emit('leave_room', { room });
    setStep('lobby'); setIsTyping(false); setIsConnecting(false); setMyRole(''); setPartnerRole('');
  };

  const handleMatchStart = (isAiMode: boolean) => {
    setIsConnecting(true); setIsSingleMode(isAiMode);
    if (ROLE_MAP[selectedTopic]) setStep('role_select');
    else {
      if (isAiMode) socketRef.current?.emit('start_ai_chat', { topic: selectedTopic, myRole: '익명', aiRole: 'AI 파트너', userId });
      else socketRef.current?.emit('join_queue', { topic: selectedTopic, role: 'random', userId });
      setStep('waiting');
    }
    setIsConnecting(false);
  };

  const confirmRoleAndJoin = (chosenRole: 'A' | 'B' | 'random') => {
    setIsConnecting(true); const roleData = ROLE_MAP[selectedTopic];
    if (isSingleMode) {
       const myRoleName = chosenRole === 'A' ? roleData.roleA : chosenRole === 'B' ? roleData.roleB : roleData.roleA; 
       const aiRoleName = chosenRole === 'A' ? roleData.roleB : chosenRole === 'B' ? roleData.roleA : roleData.roleB;
       socketRef.current?.emit('start_ai_chat', { topic: selectedTopic, myRole: myRoleName, aiRole: aiRoleName, userId });
    } else {
       socketRef.current?.emit('join_queue', { topic: selectedTopic, role: chosenRole, roleA_name: roleData.roleA, roleB_name: roleData.roleB, userId });
    }
    setStep('waiting');
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const totalPlayHours = (myReports.length * 3 / 60).toFixed(1);
  let avgLogic = 0, avgLinguistics = 0, avgEmpathy = 0;
  if (myReports.length > 0) {
    let sumL = 0, sumLin = 0, sumE = 0, vc = 0;
    myReports.forEach(r => { if (r.stats) { sumL += r.stats.logic || 50; sumLin += r.stats.linguistics || 50; sumE += r.stats.empathy || 50; vc++; } });
    if (vc > 0) { avgLogic = Math.round(sumL/vc); avgLinguistics = Math.round(sumLin/vc); avgEmpathy = Math.round(sumE/vc); }
  }

  let pTitle = "데이터 수집 중", pDesc = "첫 대화를 완료하고 확인하세요.", tier = "Unranked";
  if (myReports.length > 0) {
    if (avgLogic >= 75 && avgEmpathy <= 50) { pTitle = "🧊 차가운 팩트폭격기"; pDesc = "감정보다는 논리와 팩트로 승부함"; }
    else if (avgLogic >= 70 && avgEmpathy > 50) { pTitle = "⚖️ 따뜻한 조언자"; pDesc = "명확한 논리 위에 다정한 배려를 얹음"; }
    else if (avgLinguistics >= 75 && avgLogic <= 60) { pTitle = "✨ 감성적인 음유시인"; pDesc = "아름답고 정교한 어휘로 감성을 전달함"; }
    else if (avgEmpathy >= 75 && avgLogic <= 60) { pTitle = "🕊️ 천사표 리스너"; pDesc = "압도적인 공감 능력으로 무장해제를 이끌어냄"; }
    else if (avgLogic >= 80 && avgLinguistics >= 80) { pTitle = "👑 무자비한 토론 제왕"; pDesc = "빈틈없는 논리와 유창한 어휘로 대화를 지배함"; }
    else { pTitle = "🌱 성장하는 소통러"; pDesc = "다양한 대화 방식을 균형 있게 흡수하며 발전 중"; }
    const os = (avgLogic + avgLinguistics + avgEmpathy) / 3;
    if (os >= 90) tier = "Top 1%"; else if (os >= 80) tier = "Top 10%"; else if (os >= 70) tier = "Top 30%"; else tier = "Top 50%";
  }

  return (
    <div className="h-[100dvh] flex flex-col w-full bg-[#050505] text-gray-100 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full pointer-events-none" />

      {sysModal.isOpen && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] p-6 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col text-center">
            <h3 className="text-lg font-bold text-white mb-2 tracking-widest">{sysModal.title}</h3>
            <p className="text-sm text-white/60 mb-8 leading-relaxed whitespace-pre-line">{sysModal.desc}</p>
            <div className="flex gap-3">
              {sysModal.type === 'confirm' && (
                <button onClick={() => setSysModal({ ...sysModal, isOpen: false })} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-sm font-bold tracking-widest transition-colors">취소</button>
              )}
              <button 
                onClick={() => { sysModal.onConfirm(); setSysModal({ ...sysModal, isOpen: false }); }} 
                className="flex-1 py-3.5 bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-sm font-bold tracking-widest transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col justify-center my-auto relative z-10 px-4 pt-4 pb-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {step === 'lobby' && activeTab === 'lobby' && (
          <LobbyView selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedTopic={selectedTopic} setSelectedTopic={setSelectedTopic} isDropdownOpen={isDropdownOpen} setIsDropdownOpen={setIsDropdownOpen} isConnecting={isConnecting} isSingleMode={isSingleMode} handleMatchStart={handleMatchStart} />
        )}
        {step === 'lobby' && activeTab === 'myRecord' && (
          <RecordView userId={userId} myReports={myReports} totalPlayHours={totalPlayHours} personaTitle={pTitle} personaDesc={pDesc} tier={tier} avgLogic={avgLogic} avgLinguistics={avgLinguistics} avgEmpathy={avgEmpathy} />
        )}
        {step === 'lobby' && activeTab === 'profile' && (
          <ProfileView userId={userId} tier={tier} personaTitle={pTitle} socketRef={socketRef} />
        )}

        {step === 'role_select' && ROLE_MAP[selectedTopic] && (
          <div className="text-center w-full flex-1 flex flex-col justify-center pb-20">
            <div className="bg-[#080808]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-2">역할을 선택하세요</h2>
              <div className="space-y-3 mb-6 mt-6">
                <button onClick={() => confirmRoleAndJoin('A')} className="w-full bg-white/5 py-3.5 rounded-xl border border-emerald-500/30 text-emerald-400">{ROLE_MAP[selectedTopic].roleA}</button>
                <button onClick={() => confirmRoleAndJoin('B')} className="w-full bg-white/5 py-3.5 rounded-xl border border-blue-500/30 text-blue-400">{ROLE_MAP[selectedTopic].roleB}</button>
                {!isSingleMode && <button onClick={() => confirmRoleAndJoin('random')} className="w-full bg-white/5 py-3.5 rounded-xl border border-white/10">상관없음 (랜덤)</button>}
              </div>
              <button onClick={() => { setStep('lobby'); setIsConnecting(false); }} className="text-xs text-white/30 underline">뒤로 가기</button>
            </div>
          </div>
        )}

        {step === 'waiting' && (
          <div className="text-center space-y-6 flex-1 flex flex-col justify-center pb-20">
            <div className="relative w-16 h-16 mx-auto"><div className="absolute inset-0 border-2 border-white/20 rounded-full"></div><div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin"></div></div>
            <p className="text-lg font-light">상대방을 찾는 중...</p>
            <button onClick={() => { setStep('lobby'); setIsConnecting(false); socketRef.current?.emit('leave_queue'); }} className="text-xs text-white/30 underline">취소</button>
          </div>
        )}

        {step === 'chat' && (
          <ChatRoom socketRef={socketRef} room={room} userId={userId} partnerId={partnerId} myRole={myRole} partnerRole={partnerRole} selectedTopic={selectedTopic} isSingleMode={isSingleMode} messages={messages} setMessages={setMessages} isTyping={isTyping} timeLeft={timeLeft} formatTime={formatTime} isAnalyzing={isAnalyzing} reportData={reportData} reportStats={reportStats} setReportData={setReportData} showAd={showAd} setShowAd={setShowAd} adCountdown={adCountdown} tier={tier} hasVoted={hasVoted} setHasVoted={setHasVoted} voteStatus={voteStatus} extensionCount={extensionCount} forceLeaveRoom={forceLeaveRoom} showModal={showModal} />
        )}
      </main>

      {step === 'lobby' && (
        <nav className="w-full max-w-lg mx-auto pb-16 pt-4 flex justify-center z-20 bg-[#050505] shrink-0 border-t border-white/5">
          <div className="flex items-center bg-black/80 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <button onClick={() => setActiveTab('lobby')} className={`px-6 py-3 rounded-full text-[11px] font-bold tracking-widest transition-all ${activeTab === 'lobby' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}>LOBBY</button>
            <button onClick={() => setActiveTab('myRecord')} className={`px-6 py-3 rounded-full text-[11px] font-bold tracking-widest transition-all ${activeTab === 'myRecord' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}>RECORD</button>
            <button onClick={() => setActiveTab('profile')} className={`px-6 py-3 rounded-full text-[11px] font-bold tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}>PROFILE</button>
          </div>
        </nav>
      )}
    </div>
  );
}