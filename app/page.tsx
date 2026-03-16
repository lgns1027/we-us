'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://we-us-backend.onrender.com';

const LOBBY_CATEGORIES = [
  { id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터 및 글로벌 유저와 실전 회화', options: ['한국어', '영어', '일본어', '프랑스어'] },
  { id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'] },
  { id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극', options: ['진상손님 방어전 (알바생)', '압박 면접 (지원자)'] }
];

export default function WeUsApp() {
  const [activeTab, setActiveTab] = useState<'lobby' | 'myRecord'>('lobby');
  const [userId, setUserId] = useState<string>('');
  const [myReports, setMyReports] = useState<any[]>([]); 

  const [step, setStep] = useState<'lobby' | 'waiting' | 'chat'>('lobby');
  const [timeLeft, setTimeLeft] = useState(180); 
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false); 
  const [isSingleMode, setIsSingleMode] = useState(false); 
  
  const [selectedCategory, setSelectedCategory] = useState<string>('lang');
  const [selectedTopic, setSelectedTopic] = useState<string>('한국어');

  const [hasVoted, setHasVoted] = useState(false);
  const [partnerVoted, setPartnerVoted] = useState(false);
  const [extensionCount, setExtensionCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(2);
  const [voteStatus, setVoteStatus] = useState(''); 

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<string | null>(null);

  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);

  const [isConnecting, setIsConnecting] = useState(false); 
  const [isTyping, setIsTyping] = useState(false); 

  const socketRef = useRef<Socket | null>(null);
  const lastInteractionTime = useRef<number>(Date.now());
  const messagesRef = useRef(messages);
  
  // ★ [핵심 픽스 1] 소켓이 끊기지 않도록, 변하는 상태값들을 Ref 주머니에 실시간 백업
  const stateRefs = useRef({ selectedTopic, isAnalyzing, reportData, showAd });

  useEffect(() => {
    stateRefs.current = { selectedTopic, isAnalyzing, reportData, showAd };
  }, [selectedTopic, isAnalyzing, reportData, showAd]);

  useEffect(() => {
    let storedId = localStorage.getItem('weus_user_id');
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('weus_user_id', storedId);
    }
    setUserId(storedId);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ★ [핵심 픽스 2] 소켓 연결 로직의 의존성 배열을 빈칸([])으로 만들어 강제 종료 방지
  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('receive_my_records', (records) => {
      setMyReports(records);
    });

    socketRef.current.on('matched', (data) => {
      setIsConnecting(false); 
      const matchRoom = data.roomName || data.roomId; 
      setRoom(matchRoom);
      setParticipantCount(data.participantCount || 2); 
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
      
      const partnerName = data.partner || `총 ${data.participantCount}명`;
      // Ref 주머니에서 안전하게 최신 주제를 꺼내옴
      setMessages([{ sender: 'System', text: `[${stateRefs.current.selectedTopic}] 주제로 ${partnerName}와 연결되었습니다.` }]);
      
      lastInteractionTime.current = Date.now();
      if (socketRef.current?.id === data.hostId) setIsHost(true);
    });

    socketRef.current.on('receive_message', (data) => {
      setIsTyping(false); 
      setMessages((prev) => [...prev, { sender: data.sender, text: data.text }]);
      lastInteractionTime.current = Date.now();
    });

    socketRef.current.on('partner_left', () => {
      // Ref 주머니에서 현재 상태를 확인하여 분석 중이 아닐 때만 튕김 처리
      const { isAnalyzing, reportData, showAd } = stateRefs.current;
      if (!isAnalyzing && !reportData && !showAd) {
        alert("남은 인원이 없어 방이 종료되었습니다.");
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
      }
    });

    return () => { socketRef.current?.disconnect(); };
  }, []); // <--- 이 부분이 핵심입니다. 빈 배열로 고정하여 절대 끊기지 않게 만듭니다.

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
    
    setMessages((prev) => [...prev, { sender: '나', text: inputText }]);
    socketRef.current?.emit('send_message', { room: room, roomId: room, text: inputText });
    setInputText('');
    lastInteractionTime.current = Date.now();
    
    // ★ UX 개선: 내가 메시지를 보내면, 무조건 상대방(또는 AI)이 타이핑 중이라고 애니메이션을 띄움
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
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WE US - AI가 분석한 내 대화',
          text: `[WE US 성적표]\n\n${reportData}\n\n👉 익명으로 대화해보기: https://we-us.online`,
        });
      } catch (error) {
        console.log('공유가 취소되었습니다.');
      }
    } else {
      alert('지원하지 않는 기기입니다. 리포트 화면을 캡처해서 공유해보세요!');
    }
  };

  // 현재 선택된 카테고리의 옵션 리스트 찾기
  const currentOptions = LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.options || [];

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[100px] rounded-full pointer-events-none" />

      {step === 'lobby' && activeTab === 'myRecord' && (
        <div className="w-full max-w-lg h-[85vh] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col z-10 shadow-2xl relative">
          <h2 className="text-2xl font-light tracking-widest text-white mb-2">MY RECORD</h2>
          <p className="text-xs text-white/40 mb-6 font-mono">ID: {userId}</p>
          
          <div className="flex-1 overflow-y-auto space-y-4 pb-20">
            {myReports.length === 0 ? (
              <div className="text-center pt-20">
                <p className="text-sm text-white/30 tracking-widest">아직 대화 기록이 없습니다.</p>
                <p className="text-xs text-white/20 mt-2">첫 대화를 시작하고 성장을 기록해 보세요.</p>
              </div>
            ) : (
              myReports.map((report, idx) => (
                <div key={idx} className="bg-black/40 p-5 rounded-2xl border border-white/5 shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-xs font-bold tracking-wider ${report.type === 'single' ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {report.type === 'single' ? `AI 싱글 튜터링` : `익명 그룹 대화`}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                    {report.aiReport}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {step === 'lobby' && activeTab === 'lobby' && (
        <div className="text-center max-w-lg w-full space-y-8 z-10 h-[85vh] flex flex-col justify-center pb-16">
          <div className="space-y-2 mb-4">
            <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
              WE US.
            </h1>
            <p className="text-gray-400 font-light tracking-widest text-xs">우리가 되어가는 3분의 시간</p>
          </div>
          
          {/* ★ 혁신 1. 로비 큐레이션 카드 UI */}
          <div className="grid grid-cols-3 gap-3">
            {LOBBY_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedTopic(cat.options[0]); // 첫 번째 옵션 자동 선택
                }}
                className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border ${
                  selectedCategory === cat.id 
                  ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                  : 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-100'
                }`}
              >
                <span className="text-2xl mb-1">{cat.icon}</span>
                <span className="text-xs font-bold tracking-wider text-white">{cat.title}</span>
              </button>
            ))}
          </div>

          <div className="bg-white/[0.03] backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-col text-left space-y-3">
              <label className="text-xs text-emerald-400 uppercase tracking-widest font-bold">
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
                onClick={() => {
                  setIsConnecting(true); // ★ 로딩 시작
                  setIsSingleMode(false);
                  socketRef.current?.emit('join_queue', { lang: '공통', topic: selectedTopic }); 
                  setStep('waiting');
                }}
                className="w-full bg-white text-black font-extrabold tracking-wide py-4 rounded-xl hover:bg-gray-200 transition-all shadow-lg flex justify-center items-center gap-2"
              >
                {isConnecting && !isSingleMode ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/> : null}
                익명 매칭 시작하기
              </button>
              <button 
                disabled={isConnecting}
                onClick={() => {
                  setIsConnecting(true); // ★ 로딩 시작
                  setIsSingleMode(true);
                  socketRef.current?.emit('start_ai_chat', selectedTopic); 
                }}
                className="w-full bg-transparent hover:bg-white/5 text-white/70 font-semibold tracking-wide py-4 rounded-xl border border-white/10 transition-all flex justify-center items-center gap-2"
              >
                {isConnecting && isSingleMode ? <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin"/> : null}
                AI와 먼저 연습하기
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'lobby' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-1.5 z-20 shadow-2xl">
          <button 
            onClick={() => setActiveTab('lobby')}
            className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest transition-all ${activeTab === 'lobby' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}
          >
            LOBBY
          </button>
          <button 
            onClick={() => setActiveTab('myRecord')}
            className={`px-8 py-3 rounded-full text-sm font-bold tracking-widest transition-all ${activeTab === 'myRecord' ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white/80'}`}
          >
            RECORD
          </button>
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
            <button onClick={() => { setStep('lobby'); setIsConnecting(false); }} className="text-sm text-white/30 hover:text-white/80 underline tracking-widest transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {step === 'chat' && (
        <div className="w-full max-w-lg h-[85vh] bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-white/10 relative z-10">
          
          {showAd && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[60] p-4 backdrop-blur-md">
              <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
                <div className="p-2 bg-gray-950 text-[10px] text-gray-500 text-right">Sponsored</div>
                <div className="h-56 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6 text-center relative">
                  <h3 className="text-2xl font-black text-white mb-2 z-10">분석을 완료하는 중...</h3>
                  <p className="text-white/90 text-sm z-10 font-medium">WE US 프리미엄 패스를 확인해보세요</p>
                </div>
                <div className="p-4 flex justify-between items-center bg-gray-900 border-t border-gray-800">
                  <span className="text-xs text-gray-400 font-bold">
                    {adCountdown > 0 ? `AI 분석 중...` : '리포트 준비 완료!'}
                  </span>
                  <button
                    onClick={() => setShowAd(false)}
                    disabled={adCountdown > 0}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      adCountdown > 0 ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-gray-200'
                    }`}
                  >
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
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col">
                <h2 className="text-xl font-light tracking-widest text-center mb-8 text-white">
                  {isSingleMode ? 'PERSONAL REPORT' : 'CHEMISTRY REPORT'}
                </h2>
                <div className="space-y-4 text-sm text-gray-300 whitespace-pre-line leading-relaxed flex-1 bg-black/40 p-6 rounded-2xl border border-white/5">
                  {reportData}
                </div>
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={handleShare}
                    className="flex-1 bg-white text-black font-bold tracking-wide py-3.5 rounded-xl hover:bg-gray-200 transition"
                  >
                    공유하기
                  </button>
                  <button
                    onClick={() => {
                      setReportData(null);
                      setStep('lobby');
                    }}
                    className="px-6 bg-transparent hover:bg-white/5 text-white/70 font-semibold tracking-wide py-3.5 rounded-xl border border-white/10 transition"
                  >
                    로비
                  </button>
                </div>
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
                <button 
                  onClick={leaveRoom}
                  className="bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 text-[10px] px-2.5 py-1 rounded-full transition-colors border border-transparent hover:border-red-500/30"
                >
                  나가기
                </button>
              </div>
              {!isSingleMode && <span className="text-xs text-white/40 tracking-wider">참여 인원: {participantCount}명</span>}
            </div>
            <div className={`px-3 py-1 rounded-full border ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/80'}`}>
              <span className="font-mono text-sm tracking-wider font-medium">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4 pb-24 flex flex-col">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === '나' ? 'justify-end' : msg.sender === 'System' ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3.5 rounded-2xl text-[15px] leading-relaxed ${
                  msg.sender === '나' ? 'bg-white text-black rounded-tr-sm' : 
                  msg.sender === 'System' ? 'bg-transparent text-white/40 text-xs border border-white/10 rounded-full px-5 py-2 text-center' :
                  msg.sender === 'AI 🤖' || msg.sender === 'AI' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tl-sm' : 'bg-white/10 text-white rounded-tl-sm'
                }`}>
                  {msg.sender !== 'System' && <span className={`text-[11px] block mb-1 font-bold ${msg.sender === '나' ? 'text-gray-500' : 'text-white/40'}`}>{msg.sender}</span>}
                  <span>{msg.text}</span>
                </div>
              </div>
            ))}
            
            {/* ★ 혁신 2. 타이핑 인디케이터 애니메이션 */}
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
              <button
                onClick={() => { setHasVoted(true); socketRef.current?.emit('vote_extend', { room }); }}
                disabled={hasVoted}
                className={`px-6 py-2.5 rounded-full font-bold text-sm shadow-lg transition-all border ${
                  hasVoted ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300'
                }`}
              >
                {hasVoted ? `동의 대기중 ${voteStatus}` : `+ 2분 연장하기 (${extensionCount}/2)`}
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="p-4 bg-[#050505] border-t border-white/5 flex gap-2 z-10 relative">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isAnalyzing || !!reportData || showAd} 
              placeholder="메시지 입력..." 
              className="flex-1 bg-white/5 text-white px-5 py-3.5 rounded-full outline-none focus:bg-white/10 transition-colors disabled:opacity-50 text-sm placeholder:text-white/20 border border-transparent focus:border-white/10"
            />
            <button type="submit" disabled={isAnalyzing || !!reportData || showAd || !inputText.trim()} className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center font-bold hover:bg-gray-200 disabled:opacity-50 transition-colors shrink-0">
              ↑
            </button>
          </form>
        </div>
      )}
    </div>
  );
}