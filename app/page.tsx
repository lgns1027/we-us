'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://we-us-backend.onrender.com';

export default function WeUsApp() {
  // ★ 탭 및 유저 식별 상태
  const [activeTab, setActiveTab] = useState<'lobby' | 'myRecord'>('lobby');
  const [userId, setUserId] = useState<string>('');
  const [myReports, setMyReports] = useState<any[]>([]); // 추후 DB에서 불러올 내 기록들

  const [step, setStep] = useState<'lobby' | 'waiting' | 'chat'>('lobby');
  const [timeLeft, setTimeLeft] = useState(180); 
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false); 
  const [isSingleMode, setIsSingleMode] = useState(false); 
  
  const [selectedLang, setSelectedLang] = useState('한국어');
  const [selectedTopic, setSelectedTopic] = useState('일상 대화');

  const [hasVoted, setHasVoted] = useState(false);
  const [partnerVoted, setPartnerVoted] = useState(false);
  const [extensionCount, setExtensionCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(2);
  const [voteStatus, setVoteStatus] = useState(''); 

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<string | null>(null);

  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);

  const socketRef = useRef<Socket | null>(null);
  const lastInteractionTime = useRef<number>(Date.now());
  const messagesRef = useRef(messages);

  // ★ 1. 기기 고유 ID(UUID) 발급 로직
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

  // ★ 2. 소켓 통신 로직
  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('matched', (data) => {
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
      
      const partnerName = data.partner || `총 ${data.participantCount}명`;
      setMessages([{ sender: 'System', text: `매칭 성공! [${selectedLang} - ${selectedTopic}] 모드로 ${partnerName}이 대화를 시작합니다.` }]);
      
      lastInteractionTime.current = Date.now();
      if (socketRef.current?.id === data.hostId) setIsHost(true);
    });

    socketRef.current.on('receive_message', (data) => {
      setMessages((prev) => [...prev, { sender: data.sender, text: data.text }]);
      lastInteractionTime.current = Date.now();
    });

    socketRef.current.on('partner_left', () => {
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
  }, [selectedLang, selectedTopic, isAnalyzing, reportData, showAd]);

  // ★ 3. 타이머 및 AI 상태 관리
  useEffect(() => {
    if (step !== 'chat' || timeLeft <= 0 || isAnalyzing || reportData || showAd) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsAnalyzing(true);
          setShowAd(true);        
          setAdCountdown(3);      
          // 여기서 userId도 같이 보내서 DB에 누구 건지 기록하게 만들 예정
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

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* S급 디테일: 배경의 은은한 네온 글로우 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[100px] rounded-full pointer-events-none" />

      {/* ============================== */}
      {/* [1] 마이페이지 (RECORD 탭) 화면 */}
      {/* ============================== */}
      {step === 'lobby' && activeTab === 'myRecord' && (
        <div className="w-full max-w-lg h-[85vh] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col z-10 shadow-2xl relative">
          <h2 className="text-2xl font-light tracking-widest text-white mb-2">MY RECORD</h2>
          <p className="text-xs text-white/40 mb-6 font-mono">ID: {userId}</p>
          
          <div className="flex-1 overflow-y-auto space-y-4 pb-20">
            {/* 임시 데이터 (나중에 백엔드와 연결하여 렌더링) */}
            <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-emerald-400 font-bold tracking-wider">AI 싱글 모드 (영어)</span>
                <span className="text-[10px] text-white/30">방금 전</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                [종합 성취도: 85점] 대화의 강점: 시제 표현이 매우 정확합니다. 성장을 위한 조언: 감정 표현 형용사를 더 다양하게 써보세요.
              </p>
            </div>

            <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-blue-400 font-bold tracking-wider">극단적 취향 전투장</span>
                <span className="text-[10px] text-white/30">어제</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                [대화 밀도: 92점] 팩트폭격기 성향이 강합니다. 날카로운 논리로 대화를 주도했습니다.
              </p>
            </div>
            
            <div className="text-center pt-10">
              <p className="text-sm text-white/30">곧 실제 대화 기록이 이곳에 누적됩니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* [2] 로비 화면 (LOBBY 탭) */}
      {/* ============================== */}
      {step === 'lobby' && activeTab === 'lobby' && (
        <div className="text-center max-w-md w-full space-y-10 z-10">
          <div className="space-y-3">
            <h1 className="text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
              WE US.
            </h1>
            <p className="text-gray-400 font-light tracking-widest text-sm">우리가 되어가는 3분의 시간</p>
          </div>
          
          <div className="bg-white/[0.03] backdrop-blur-xl p-8 rounded-3xl border border-white/5 space-y-6 shadow-2xl">
            <div className="flex flex-col text-left space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold">언어 선택</label>
              <select 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value)}
                className="bg-black/40 border border-white/10 text-white text-sm rounded-xl focus:ring-1 focus:ring-white/30 focus:border-white/30 block w-full p-3.5 outline-none cursor-pointer appearance-none transition-all"
              >
                <option value="한국어">🇰🇷 한국어 (Korean)</option>
                <option value="영어">🇺🇸 영어 (English)</option>
                <option value="일본어">🇯🇵 일본어 (Japanese)</option>
                <option value="프랑스어">🇫🇷 프랑스어 (French)</option>
              </select>
            </div>

            <div className="flex flex-col text-left space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold">대화 주제</label>
              <select 
                value={selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-black/40 border border-white/10 text-white text-sm rounded-xl focus:ring-1 focus:ring-white/30 focus:border-white/30 block w-full p-3.5 outline-none cursor-pointer appearance-none transition-all"
              >
                <option value="일상 대화">☕ 편안한 일상 대화</option>
                <option value="영화/문화">🍿 영화와 문화</option>
                <option value="극단적 밸런스게임">⚖️ 극단적 취향 전투장 (VS)</option>
                <option value="상황극: 알바생과 진상손님">🤬 알바생과 진상손님 방어전</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => {
                setIsSingleMode(false);
                setStep('waiting');
                socketRef.current?.emit('join_queue', { lang: selectedLang, topic: selectedTopic }); 
              }}
              className="w-full bg-white text-black font-extrabold tracking-wide py-4 rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              익명 매칭 시작하기
            </button>
            <button 
              onClick={() => {
                setIsSingleMode(true);
                socketRef.current?.emit('start_ai_chat', selectedLang); 
              }}
              className="w-full bg-transparent hover:bg-white/5 text-white/70 font-semibold tracking-wide py-4 rounded-xl border border-white/10 transition-all"
            >
              AI와 먼저 연습하기
            </button>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* [3] 하단 네비게이션 탭 (로비 화면일 때만 노출) */}
      {/* ============================== */}
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

      {/* ============================== */}
      {/* [4] 대기열 & 채팅방 화면 (기존과 동일) */}
      {/* ============================== */}
      {step === 'waiting' && (
        <div className="text-center space-y-6 z-10">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-2 border-white/20 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-xl font-light text-white tracking-wider">상대방을 찾는 중...</p>
          <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <p className="text-sm text-white/60">
              {selectedLang} <span className="mx-2">•</span> {selectedTopic}
            </p>
          </div>
          <div className="pt-8">
            <button onClick={() => setStep('lobby')} className="text-sm text-white/30 hover:text-white/80 underline tracking-widest transition-colors">
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
              <p className="text-white font-light tracking-widest">
                {isSingleMode ? 'AI가 대화 흐름을 분석하고 있습니다...' : '두 사람의 케미를 분석하고 있습니다...'}
              </p>
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
                  {isSingleMode ? `AI 싱글 모드` : `${selectedTopic}`}
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
              <span className="font-mono text-sm tracking-wider font-medium">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4 pb-24">
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
          </div>

          {timeLeft <= 60 && !isSingleMode && !isAnalyzing && !reportData && extensionCount < 2 && !showAd && (
            <div className="absolute bottom-[80px] left-0 w-full p-3 bg-gradient-to-t from-[#0a0a0a] to-transparent flex flex-col items-center justify-center">
              <button
                onClick={() => {
                  setHasVoted(true);
                  socketRef.current?.emit('vote_extend', { room });
                }}
                disabled={hasVoted}
                className={`px-6 py-2.5 rounded-full font-bold text-sm shadow-lg transition-all border ${
                  hasVoted ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300'
                }`}
              >
                {hasVoted ? `동의 대기중 ${voteStatus}` : `+ 2분 연장하기 (${extensionCount}/2)`}
              </button>
              {partnerVoted && !hasVoted && (
                <span className="mt-2 text-[11px] text-emerald-400/80 font-medium tracking-wide">
                  상대방이 시간 연장을 원합니다.
                </span>
              )}
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
            <button type="submit" disabled={isAnalyzing || !!reportData || showAd} className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center font-bold hover:bg-gray-200 disabled:opacity-50 transition-colors shrink-0">
              ↑
            </button>
          </form>
        </div>
      )}
    </div>
  );
}