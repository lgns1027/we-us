'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import html2canvas from 'html2canvas'; 

const SERVER_URL = 'https://we-us-backend.onrender.com';

const LOBBY_CATEGORIES = [
  { id: 'daily', icon: '☕', title: '일상 라운지', desc: '부담 없는 스몰토크와 편안한 일상 대화', options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'] },
  { id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터 및 글로벌 유저와 실전 회화', options: ['영어', '일본어', '프랑스어', '한국어(외국인용)'] },
  { id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'] },
  { id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극', options: ['진상손님 방어전', '압박 면접'] } // (알바생), (지원자) 텍스트 제거
];

const ROLE_MAP: Record<string, { roleA: string, roleB: string }> = {
  '100억 받기 VS 무병장수': { roleA: '100억 선택', roleB: '무병장수 선택' },
  '자본주의 생존기': { roleA: '자본주의 찬성론자', roleB: '자본주의 회의론자' },
  '최악의 이불킥 경험': { roleA: '썰 푸는 화자', roleB: '공감하는 리스너' },
  '진상손님 방어전': { roleA: '알바생', roleB: '진상손님' },
  '압박 면접': { roleA: '지원자', roleB: '면접관' }
};

// ★ 핵심 추가: 유저의 몰입도를 200% 끌어올릴 구체적인 딜레마 미션
const ROLE_MISSIONS: Record<string, Record<string, string>> = {
  '압박 면접': {
    '지원자': "당신은 이력서에 '해외 영업 3년'이라 적었지만, 사실 워킹홀리데이 3개월이 전부입니다. 면접관의 압박을 3분간 어떻게든 방어하세요.",
    '면접관': "눈앞의 지원자는 해외 영업 경력이 3년이라는데, 왠지 철저한 거짓말 같습니다. 3분 동안 집요하게 꼬리 질문을 던져 멘탈을 박살 내세요."
  },
  '진상손님 방어전': {
    '알바생': "당신은 카페 알바생입니다. 손님이 다 마신 커피 얼음을 가져와서 '얼음이 너무 빨리 녹았다'며 새 음료로 환불을 요구합니다. 절대 환불해주지 마세요.",
    '진상손님': "당신은 커피를 다 마셨지만 돈이 아깝습니다. 얼음이 너무 빨리 녹았다는 억지 논리를 펴서 어떻게든 알바생에게 전액 환불을 받아내세요."
  },
  '100억 받기 VS 무병장수': {
    '100억 선택': "당신은 100억을 선택했습니다. 무병장수를 고른 상대에게 '돈 없는 장수는 저주'라는 논리로 팩트폭행을 가하세요.",
    '무병장수 선택': "당신은 무병장수를 선택했습니다. 100억을 고른 상대에게 '건강을 잃으면 돈은 휴지조각'이라는 논리로 상대를 압도하세요."
  }
};

export default function WeUsApp() {
  const [activeTab, setActiveTab] = useState<'lobby' | 'myRecord'>('lobby');
  const [userId, setUserId] = useState<string>('');
  const [myReports, setMyReports] = useState<any[]>([]); 

  const [step, setStep] = useState<'lobby' | 'role_select' | 'waiting' | 'chat'>('lobby');
  const [timeLeft, setTimeLeft] = useState(180); 
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false); 
  const [isSingleMode, setIsSingleMode] = useState(false); 
  
  const [selectedCategory, setSelectedCategory] = useState<string>('daily');
  const [selectedTopic, setSelectedTopic] = useState<string>('가벼운 스몰토크');
  
  const [myRole, setMyRole] = useState<string>('');
  const [partnerRole, setPartnerRole] = useState<string>('');

  const [hasVoted, setHasVoted] = useState(false);
  const [partnerVoted, setPartnerVoted] = useState(false);
  const [extensionCount, setExtensionCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(2);
  const [voteStatus, setVoteStatus] = useState(''); 

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<string | null>(null);
  
  const reportCardRef = useRef<HTMLDivElement>(null); 
  const [isCapturing, setIsCapturing] = useState(false);

  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);

  const [isConnecting, setIsConnecting] = useState(false); 
  const [isTyping, setIsTyping] = useState(false); 

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const lastInteractionTime = useRef<number>(Date.now());
  const messagesRef = useRef(messages);
  
  const stateRefs = useRef({ selectedTopic, isAnalyzing, reportData, showAd });

  useEffect(() => {
    stateRefs.current = { selectedTopic, isAnalyzing, reportData, showAd };
  }, [selectedTopic, isAnalyzing, reportData, showAd]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

    socketRef.current.on('receive_my_records', (records) => {
      setMyReports(records);
    });

    socketRef.current.on('matched', (data) => {
      setIsConnecting(false); 
      setRoom(data.roomName || data.roomId);
      setParticipantCount(data.participantCount || 2); 
      setMyRole(data.myRole || '나');
      setPartnerRole(data.partner || '상대방');
      
      setStep('chat');
      setTimeLeft(180); 
      setHasVoted(false);
      setPartnerVoted(false);
      setVoteStatus('');
      setExtensionCount(0); 
      setIsAnalyzing(false);
      setReportData(null);
      setShowAd(false); 
      setIsTyping(false); 
      
      // ★ 미션 텍스트 적용
      const topic = stateRefs.current.selectedTopic;
      const role = data.myRole;
      const missionText = ROLE_MISSIONS[topic]?.[role] || `당신은 [${role}] 역할을 배정받았습니다. 상대방과 대화를 시작해 보세요.`;
      
      setMessages([{ sender: 'System', text: `🎯 [미션 하달]\n${missionText}` }]);
      
      lastInteractionTime.current = Date.now();
      if (socketRef.current?.id === data.hostId) setIsHost(true);
    });

    socketRef.current.on('receive_message', (data) => {
      setIsTyping(false); 
      setMessages((prev) => [...prev, { sender: data.sender, text: data.text }]);
      lastInteractionTime.current = Date.now();
    });

    socketRef.current.on('partner_left', () => {
      const { isAnalyzing, reportData, showAd } = stateRefs.current;
      if (!isAnalyzing && !reportData && !showAd) {
        alert("상대방이 나가 대화가 종료되었습니다.");
        setStep('lobby');
      }
    });

    socketRef.current.on('partner_wants_extension', (data) => {
      setPartnerVoted(true);
      setVoteStatus(`(${data.currentVotes}/${data.total}명 동의)`);
      if(data.currentVotes === 1) {
          setMessages((prev) => [...prev, { sender: 'System', text: '누군가 대화 시간 연장을 원합니다! 버튼을 눌러 수락해 주세요.' }]);
      }
    });

    socketRef.current.on('time_extended', (data) => {
      setTimeLeft((prev) => prev + data.addedTime);
      setHasVoted(false); 
      setPartnerVoted(false);
      setVoteStatus('');
      setExtensionCount(data.currentExtensions);
      setMessages((prev) => [...prev, { 
        sender: 'System', 
        text: `🎉 전원 동의로 대화 시간이 2분 연장되었습니다! (남은 연장 기회: ${2 - data.currentExtensions}번)` 
      }]);
    });

    socketRef.current.on('receive_report', (data) => {
      setIsAnalyzing(false);
      if (data.error) {
        setReportData("대화 내용이 너무 짧거나 시스템 오류로 리포트를 발급할 수 없습니다.");
      } else {
        setReportData(data.reportText);
        if (userId) socketRef.current?.emit('request_my_records', userId);
      }
    });

    return () => { socketRef.current?.disconnect(); };
  }, [userId]); 

  useEffect(() => {
    if (activeTab === 'myRecord' && userId && socketRef.current) {
      socketRef.current.emit('request_my_records', userId);
    }
  }, [activeTab, userId]);

  useEffect(() => {
    if (step !== 'chat' || timeLeft <= 0 || isAnalyzing || reportData || showAd) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsAnalyzing(true);
          setShowAd(true);        
          setAdCountdown(3);      
          socketRef.current?.emit('request_chemistry_report', { room, userId }); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft, room, isAnalyzing, reportData, showAd, userId]);

  useEffect(() => {
    if (!showAd || adCountdown <= 0) return;
    const adTimer = setInterval(() => {
      setAdCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(adTimer);
  }, [showAd, adCountdown]);

  useEffect(() => {
    if (step !== 'chat' || isSingleMode) return; 
    const silenceChecker = setInterval(() => {
      const now = Date.now();
      if (now - lastInteractionTime.current > 10000 && isHost) {
        socketRef.current?.emit('request_ai_help', { room, history: messagesRef.current });
        lastInteractionTime.current = Date.now(); 
      }
    }, 1000);
    return () => clearInterval(silenceChecker);
  }, [step, room, isHost, isSingleMode]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !room) return;
    
    setMessages((prev) => [...prev, { sender: myRole || '나', text: inputText }]);
    socketRef.current?.emit('send_message', { room: room, roomId: room, text: inputText, partner: partnerRole });
    setInputText('');
    lastInteractionTime.current = Date.now();
    setIsTyping(true); 
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const leaveRoom = () => {
    if (confirm("정말 대화방에서 나가시겠습니까?")) {
      socketRef.current?.emit('leave_room', { room });
      setStep('lobby');
      setIsTyping(false);
      setIsConnecting(false);
      setMyRole('');
      setPartnerRole('');
    }
  };

  const handleReportSubmit = () => {
    if (!reportReason) {
      alert("신고 사유를 선택해 주세요.");
      return;
    }
    if (confirm("상대방을 신고하고 대화방을 즉시 나가시겠습니까?")) {
      socketRef.current?.emit('report_user', { room, reporterId: userId, reason: reportReason });
      alert("신고가 접수되었습니다. 철저히 검토하여 조치하겠습니다.");
      setIsReportModalOpen(false);
      setReportReason('');
      socketRef.current?.emit('leave_room', { room });
      setStep('lobby');
      setIsTyping(false);
      setIsConnecting(false);
    }
  };

  const handleShareCard = async () => {
    if (!reportCardRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(reportCardRef.current, { scale: 2, backgroundColor: '#0a0a0a', useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'weus_card.png', { type: 'image/png' })] })) {
          const file = new File([blob], 'weus_persona.png', { type: 'image/png' });
          await navigator.share({
            title: 'WE US - 나의 대화 페르소나',
            text: '나의 소통 능력 티어와 페르소나를 확인해보세요! 👉 we-us.online',
            files: [file],
          });
        } else {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = 'weus_persona.png';
          link.click();
          alert('페르소나 카드가 사진첩에 저장되었습니다. 인스타그램에 바로 공유해 보세요!');
        }
      }, 'image/png');
    } catch (err) {
      console.error('공유 캡처 에러:', err);
      alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleMatchStart = (isAiMode: boolean) => {
    setIsConnecting(true);
    setIsSingleMode(isAiMode);
    
    const roleData = ROLE_MAP[selectedTopic];
    if (roleData) {
      setStep('role_select');
      setIsConnecting(false);
    } else {
      if (isAiMode) {
        socketRef.current?.emit('start_ai_chat', { topic: selectedTopic, myRole: '익명', aiRole: 'AI 파트너' });
      } else {
        socketRef.current?.emit('join_queue', { topic: selectedTopic, role: 'random' });
      }
      setStep('waiting');
    }
  };

  const confirmRoleAndJoin = (chosenRole: 'A' | 'B' | 'random') => {
    setIsConnecting(true);
    const roleData = ROLE_MAP[selectedTopic];
    
    if (isSingleMode) {
       const myRoleName = chosenRole === 'A' ? roleData.roleA : chosenRole === 'B' ? roleData.roleB : roleData.roleA; 
       const aiRoleName = chosenRole === 'A' ? roleData.roleB : chosenRole === 'B' ? roleData.roleA : roleData.roleB;
       socketRef.current?.emit('start_ai_chat', { topic: selectedTopic, myRole: myRoleName, aiRole: aiRoleName });
    } else {
       socketRef.current?.emit('join_queue', { 
         topic: selectedTopic, 
         role: chosenRole, 
         roleA_name: roleData.roleA, 
         roleB_name: roleData.roleB 
       });
    }
    setStep('waiting');
  };

  const currentOptions = LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.options || [];
  const currentRoleData = ROLE_MAP[selectedTopic];

  const totalPlayHours = (myReports.length * 3 / 60).toFixed(1);
  let avgLogic = 0, avgLinguistics = 0, avgEmpathy = 0;
  if (myReports.length > 0) {
    let sumLogic = 0, sumLinguistics = 0, sumEmpathy = 0, validCount = 0;
    myReports.forEach(report => {
      if (report.stats) {
        sumLogic += report.stats.logic || 50;
        sumLinguistics += report.stats.linguistics || 50;
        sumEmpathy += report.stats.empathy || 50;
        validCount++;
      }
    });
    if (validCount > 0) {
      avgLogic = Math.round(sumLogic / validCount);
      avgLinguistics = Math.round(sumLinguistics / validCount);
      avgEmpathy = Math.round(sumEmpathy / validCount);
    }
  }

  let personaTitle = "데이터 수집 중";
  let personaDesc = "첫 대화를 완료하고 페르소나를 확인하세요.";
  let tier = "Unranked";
  
  if (myReports.length > 0) {
    if (avgLogic >= 75 && avgEmpathy <= 50) { personaTitle = "🧊 차가운 팩트폭격기"; personaDesc = "감정보다는 철저한 논리와 팩트로 승부함"; }
    else if (avgLogic >= 70 && avgEmpathy > 50) { personaTitle = "⚖️ 따뜻한 조언자"; personaDesc = "명확한 논리 위에 다정한 배려를 얹음"; }
    else if (avgLinguistics >= 75 && avgLogic <= 60) { personaTitle = "✨ 감성적인 음유시인"; personaDesc = "아름답고 정교한 어휘로 감성을 전달함"; }
    else if (avgEmpathy >= 75 && avgLogic <= 60) { personaTitle = "🕊️ 천사표 리스너"; personaDesc = "압도적인 공감 능력으로 상대의 무장해제를 이끌어냄"; }
    else if (avgLogic >= 80 && avgLinguistics >= 80) { personaTitle = "👑 무자비한 토론 제왕"; personaDesc = "빈틈없는 논리와 유창한 어휘로 대화를 지배함"; }
    else { personaTitle = "🌱 성장하는 소통러"; personaDesc = "다양한 대화 방식을 균형 있게 흡수하며 발전 중"; }

    const overallScore = (avgLogic + avgLinguistics + avgEmpathy) / 3;
    if (overallScore >= 90) tier = "Top 1%";
    else if (overallScore >= 80) tier = "Top 10%";
    else if (overallScore >= 70) tier = "Top 30%";
    else tier = "Top 50%";
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* RECORD 탭 */}
      {step === 'lobby' && activeTab === 'myRecord' && (
        <div className="w-full max-w-lg h-[85vh] bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-8 flex flex-col z-10 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.3em] text-white/50 mb-1">ANALYTICS</h2>
              <p className="text-[10px] text-white/30 tracking-widest truncate max-w-[150px]">{userId}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">{tier}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors">
              <span className="text-[10px] text-white/40 tracking-widest uppercase mb-2">누적 지적 자산</span>
              <span className="text-2xl font-light text-white mb-1">{totalPlayHours}<span className="text-sm text-white/30 ml-1">hrs</span></span>
              <span className="text-xs text-white/50">총 대화 시간</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors">
              <span className="text-[10px] text-white/40 tracking-widest uppercase mb-2">주요 페르소나</span>
              <span className="text-sm font-semibold text-emerald-300 mb-1">{personaTitle}</span>
              <span className="text-[10px] text-white/50 leading-tight">{personaDesc}</span>
            </div>
          </div>

          <div className="space-y-5 mb-8">
            <div>
              <div className="flex justify-between text-[11px] font-medium text-white/60 mb-1.5 uppercase tracking-wider">
                <span>논리적 압도력 (Logic)</span>
                <span>{myReports.length > 0 ? avgLogic : '-'} / 100</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${myReports.length > 0 ? avgLogic : 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-medium text-white/60 mb-1.5 uppercase tracking-wider">
                <span>언어적 정교함 (Linguistics)</span>
                <span>{myReports.length > 0 ? avgLinguistics : '-'} / 100</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${myReports.length > 0 ? avgLinguistics : 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-medium text-white/60 mb-1.5 uppercase tracking-wider">
                <span>공감 및 경청 (Empathy)</span>
                <span>{myReports.length > 0 ? avgEmpathy : '-'} / 100</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]" style={{ width: `${myReports.length > 0 ? avgEmpathy : 0}%` }}></div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0 -mx-4 px-4 pb-20 scrollbar-hide">
            <h3 className="text-[10px] text-white/30 tracking-widest uppercase mb-4 sticky top-0 bg-[#080808]/90 backdrop-blur-md py-2">
              최근 인사이트 노트
            </h3>
            {myReports.length === 0 ? (
              <div className="text-center pt-10">
                <p className="text-xs text-white/30 tracking-widest">분석된 데이터가 없습니다.</p>
              </div>
            ) : (
              myReports.map((report, idx) => (
                <div key={idx} className="border-b border-white/5 py-5 last:border-0 group cursor-pointer">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className={`text-[11px] font-bold tracking-widest uppercase ${report.type === 'single' ? 'text-emerald-500/80' : 'text-blue-500/80'}`}>
                      {report.type === 'single' ? `TUTORING • ${report.topic || 'AI'}` : `SALON • ${report.topic}`}
                    </span>
                    <span className="text-[9px] text-white/20 font-mono">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line group-hover:text-white transition-colors">{report.aiReport}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LOBBY 화면 */}
      {step === 'lobby' && activeTab === 'lobby' && (
        <div className="text-center max-w-lg w-full space-y-8 z-10 h-[85vh] flex flex-col justify-center pb-16">
          <div className="space-y-2 mb-4">
            <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
              WE US.
            </h1>
            <p className="text-gray-400 font-light tracking-widest text-xs">우리가 되어가는 3분의 시간</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {LOBBY_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedTopic(cat.options[0]); 
                }}
                className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all border ${
                  selectedCategory === cat.id 
                  ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                  : 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-100'
                }`}
              >
                <span className="text-xl mb-1">{cat.icon}</span>
                <span className="text-[10px] font-bold tracking-wider text-white whitespace-nowrap">{cat.title}</span>
              </button>
            ))}
          </div>

          <div className="bg-white/[0.03] backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-col text-left space-y-3">
              <label className="text-[11px] text-emerald-400 uppercase tracking-widest font-bold">
                {LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.desc}
              </label>
              <select 
                value={selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-black/40 border border-white/10 text-white text-sm rounded-xl focus:ring-1 focus:ring-white/30 focus:border-white/30 block w-full p-4 outline-none cursor-pointer appearance-none transition-all"
              >
                {currentOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3 pt-2">
              <button 
                disabled={isConnecting}
                onClick={() => handleMatchStart(false)}
                className="w-full bg-white text-black font-extrabold tracking-wide py-4 rounded-xl hover:bg-gray-200 transition-all shadow-lg flex justify-center items-center gap-2 text-sm"
              >
                {isConnecting && !isSingleMode ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : null}
                익명 매칭 시작하기
              </button>
              <button 
                disabled={isConnecting}
                onClick={() => handleMatchStart(true)}
                className="w-full bg-transparent hover:bg-white/5 text-white/70 font-semibold tracking-wide py-4 rounded-xl border border-white/10 transition-all flex justify-center items-center gap-2 text-sm"
              >
                {isConnecting && isSingleMode ? <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin"/> : null}
                AI와 먼저 연습하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 역할 선택 모달 */}
      {step === 'role_select' && currentRoleData && (
        <div className="text-center max-w-sm w-full z-10 h-[85vh] flex flex-col justify-center">
          <div className="bg-[#080808]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">역할을 선택하세요</h2>
            <p className="text-xs text-white/50 mb-8 tracking-widest break-keep">
              [{selectedTopic}] 1:1 대결을 위한 역할을 고릅니다.
            </p>
            
            <div className="space-y-3 mb-6">
              <button onClick={() => confirmRoleAndJoin('A')} className="w-full bg-white/5 hover:bg-white/10 border border-emerald-500/30 py-4 rounded-xl font-bold text-emerald-400 transition flex justify-between px-6">
                <span>{currentRoleData.roleA}</span>
                <span className="text-[10px] font-normal text-white/40 flex items-center">선택 ➔</span>
              </button>
              <button onClick={() => confirmRoleAndJoin('B')} className="w-full bg-white/5 hover:bg-white/10 border border-blue-500/30 py-4 rounded-xl font-bold text-blue-400 transition flex justify-between px-6">
                <span>{currentRoleData.roleB}</span>
                <span className="text-[10px] font-normal text-white/40 flex items-center">선택 ➔</span>
              </button>
              {!isSingleMode && (
                <button onClick={() => confirmRoleAndJoin('random')} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-xl font-bold text-white/80 transition flex justify-between px-6">
                  <span>상관없음 (랜덤)</span>
                  <span className="text-[10px] font-normal text-white/40 flex items-center">빠른매칭 ➔</span>
                </button>
              )}
            </div>
            <button onClick={() => { setStep('lobby'); setIsConnecting(false); }} className="text-xs text-white/30 hover:text-white/60 underline tracking-widest">
              뒤로 가기
            </button>
          </div>
        </div>
      )}

      {step === 'lobby' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-1.5 z-20 shadow-2xl">
          <button onClick={() => setActiveTab('lobby')} className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest transition-all ${activeTab === 'lobby' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}>LOBBY</button>
          <button onClick={() => setActiveTab('myRecord')} className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest transition-all ${activeTab === 'myRecord' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}>RECORD</button>
        </div>
      )}

{step === 'waiting' && (
        <div className="text-center space-y-6 z-10">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-2 border-white/20 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-xl font-light text-white tracking-wider">상대방을 찾는 중...</p>
          <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <p className="text-sm text-white/60">{selectedTopic}</p>
          </div>
          <div className="pt-8">
            <button onClick={() => { 
              setStep('lobby'); 
              setIsConnecting(false);
              socketRef.current?.emit('leave_queue'); // ★ 대기열 삭제 신호 추가
            }} className="text-sm text-white/30 hover:text-white/80 underline tracking-widest transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {step === 'chat' && (
        <div className="w-full max-w-lg h-[85vh] bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-white/10 relative z-10">
          
          {isReportModalOpen && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[70] p-6 backdrop-blur-sm">
              <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col">
                <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2 tracking-widest">🚨 사용자 신고</h3>
                <p className="text-xs text-white/50 mb-6 leading-relaxed">건전한 환경을 위해 사유를 선택해 주세요. 신고 즉시 대화가 차단되며 서버로 전송됩니다.</p>
                <div className="space-y-2 mb-8">
                  {['욕설 및 비하', '음란성 발언', '광고 및 도배', '기타 사유'].map((reason) => (
                    <button key={reason} onClick={() => setReportReason(reason)} className={`w-full text-left p-4 rounded-xl text-xs font-semibold tracking-wider transition-all border ${reportReason === reason ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white/[0.02] border-transparent text-white/50 hover:bg-white/[0.05]'}`}>
                      {reason}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-3.5 bg-white/5 text-white/70 rounded-xl text-xs font-bold tracking-widest hover:bg-white/10 transition-colors">취소</button>
                  <button onClick={handleReportSubmit} className="flex-1 py-3.5 bg-red-900/50 text-red-200 border border-red-800/50 rounded-xl text-xs font-bold tracking-widest hover:bg-red-800 transition-colors">신고 및 나가기</button>
                </div>
              </div>
            </div>
          )}

          {showAd && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[60] p-4 backdrop-blur-md">
              <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
                <div className="p-2 bg-gray-950 text-[10px] text-gray-500 text-right">Sponsored</div>
                <div className="h-56 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6 text-center relative">
                  <h3 className="text-2xl font-black text-white mb-2 z-10">분석을 완료하는 중...</h3>
                  <p className="text-white/90 text-sm z-10 font-medium">WE US 프리미엄 패스를 확인해보세요</p>
                </div>
                <div className="p-4 flex justify-between items-center bg-gray-900 border-t border-gray-800">
                  <span className="text-xs text-gray-400 font-bold">{adCountdown > 0 ? `AI 분석 중...` : '리포트 준비 완료!'}</span>
                  <button onClick={() => setShowAd(false)} disabled={adCountdown > 0} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${adCountdown > 0 ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-gray-200'}`}>
                    {adCountdown > 0 ? `${adCountdown}초 후 건너뛰기` : '결과 보기 ▶'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isAnalyzing && !showAd && !reportData && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-40 backdrop-blur-md">
              <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
              <p className="text-white font-light tracking-widest">분석 중입니다...</p>
            </div>
          )}

          {reportData && !showAd && (
            <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center z-50 p-6 backdrop-blur-xl">
              <div ref={reportCardRef} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                   <h2 className="text-xs font-bold tracking-[0.3em] text-white/50">WE US REPORT</h2>
                   <span className="text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-1 rounded-full">{tier}</span>
                </div>
                <h2 className="text-xl font-light tracking-widest text-center mb-6 text-white">
                  {isSingleMode ? 'PERSONAL TUTORING' : 'CHEMISTRY ANALYSIS'}
                </h2>
                <div className="space-y-4 text-sm text-gray-300 whitespace-pre-line leading-relaxed flex-1 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                  {reportData}
                </div>
                <div className="mt-6 text-center text-[10px] text-white/30 font-mono">we-us.online</div>
              </div>

              <div className="w-full max-w-sm mt-6 flex gap-3 px-2">
                <button onClick={handleShareCard} disabled={isCapturing} className="flex-1 bg-white text-black font-bold tracking-wide py-3.5 rounded-xl hover:bg-gray-200 transition flex justify-center items-center gap-2">
                  {isCapturing ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : '📸 인스타용 캡처'}
                </button>
                <button onClick={() => { setReportData(null); setStep('lobby'); }} className="px-6 bg-transparent hover:bg-white/5 text-white/70 font-semibold tracking-wide py-3.5 rounded-xl border border-white/10 transition">
                  로비
                </button>
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] p-5 flex justify-between items-center border-b border-white/5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-sm text-white/90 truncate">
                  {isSingleMode ? `AI 싱글: ${selectedTopic}` : `${selectedTopic}`}
                </span>
                <div className="flex items-center gap-1">
                  {!isSingleMode && (
                    <button onClick={() => setIsReportModalOpen(true)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] px-2.5 py-1 rounded-full transition-colors border border-transparent hover:border-red-500/30 font-bold">🚨 신고</button>
                  )}
                  <button onClick={leaveRoom} className="bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-[10px] px-2.5 py-1 rounded-full transition-colors border border-transparent">나가기</button>
                </div>
              </div>
              <span className="text-xs text-emerald-400 font-bold tracking-wider pt-1">
                내 역할: [{myRole}]
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full border ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/80'}`}>
              <span className="font-mono text-sm tracking-wider font-medium">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4 pb-24 flex flex-col">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === myRole || msg.sender === '나' ? 'justify-end' : msg.sender === 'System' ? 'justify-center' : 'justify-start'}`}>
                {/* ★ 시스템 메시지(미션) 가독성을 위해 디자인 변경 */}
                <div className={`max-w-[85%] p-4 rounded-2xl text-[14px] leading-relaxed 
                  ${msg.sender === myRole || msg.sender === '나' ? 'bg-white text-black rounded-tr-sm' : 
                    msg.sender === 'System' ? 'bg-emerald-900/20 text-emerald-100 border border-emerald-500/30 rounded-xl w-full mx-auto text-center font-medium tracking-wide shadow-lg' : 
                    'bg-white/10 text-white rounded-tl-sm'}`}>
                  {msg.sender !== 'System' && <span className={`text-[11px] block mb-1 font-bold ${msg.sender === myRole || msg.sender === '나' ? 'text-gray-500' : 'text-white/40'}`}>{msg.sender}</span>}
                  <span className="whitespace-pre-line">{msg.text}</span>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="max-w-[80%] p-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/50 rounded-tl-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>

          {timeLeft <= 60 && !isSingleMode && !isAnalyzing && !reportData && extensionCount < 2 && !showAd && (
            <div className="absolute bottom-[80px] left-0 w-full p-3 bg-gradient-to-t from-[#0a0a0a] to-transparent flex flex-col items-center justify-center">
              <button onClick={() => { setHasVoted(true); socketRef.current?.emit('vote_extend', { room }); }} disabled={hasVoted} className={`px-6 py-2.5 rounded-full font-bold text-sm shadow-lg transition-all border ${hasVoted ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300'}`}>
                {hasVoted ? `동의 대기중 ${voteStatus}` : `+ 2분 연장하기 (${extensionCount}/2)`}
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="p-4 bg-[#050505] border-t border-white/5 flex gap-2 z-10 relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={isAnalyzing || !!reportData || showAd} placeholder="메시지 입력..." className="flex-1 bg-white/5 text-white px-5 py-3.5 rounded-full outline-none focus:bg-white/10 transition-colors disabled:opacity-50 text-sm placeholder:text-white/20 border border-transparent focus:border-white/10"/>
            <button type="submit" disabled={isAnalyzing || !!reportData || showAd || !inputText.trim()} className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center font-bold hover:bg-gray-200 disabled:opacity-50 transition-colors shrink-0">↑</button>
          </form>
        </div>
      )}
    </div>
  );
}