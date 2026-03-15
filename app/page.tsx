'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://we-us-backend.onrender.com';

export default function WeUsApp() {
  const [step, setStep] = useState<'lobby' | 'waiting' | 'chat'>('lobby');
  const [timeLeft, setTimeLeft] = useState(300);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [room, setRoom] = useState('');
  const [isHost, setIsHost] = useState(false); 
  const [isSingleMode, setIsSingleMode] = useState(false); // ★ 싱글 모드인지 확인하는 변수 추가
  
  const [selectedLang, setSelectedLang] = useState('한국어');
  const [selectedTopic, setSelectedTopic] = useState('일상 대화');

  const [hasVoted, setHasVoted] = useState(false);
  const [partnerVoted, setPartnerVoted] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const lastInteractionTime = useRef<number>(Date.now());
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    // 백엔드에서 매칭 신호가 왔을 때 (싱글/멀티 공통)
    socketRef.current.on('matched', (data) => {
      // 멀티는 roomName, 싱글은 roomId로 올 수 있으므로 둘 다 커버
      const matchRoom = data.roomName || data.roomId; 
      setRoom(matchRoom);
      setStep('chat');
      setTimeLeft(300); 
      setHasVoted(false);
      setPartnerVoted(false);
      
      const partnerName = data.partner || '익명의 상대';
      setMessages([{ sender: 'System', text: `매칭 성공! [${selectedLang} - ${selectedTopic}] 모드로 ${partnerName}와(과) 대화를 시작합니다.` }]);
      
      lastInteractionTime.current = Date.now();
      if (socketRef.current?.id === data.hostId) setIsHost(true);
    });

    socketRef.current.on('receive_message', (data) => {
      setMessages((prev) => [...prev, { sender: data.sender || '상대방', text: data.text }]);
      lastInteractionTime.current = Date.now();
    });

    socketRef.current.on('partner_left', () => {
      alert("상대방이 대화방을 떠났습니다. 수고하셨습니다.");
      setStep('lobby');
    });

    socketRef.current.on('partner_wants_extension', () => {
      setPartnerVoted(true);
      setMessages((prev) => [...prev, { sender: 'System', text: '상대방이 대화 시간 연장을 원합니다! 버튼을 눌러 수락해 주세요.' }]);
    });

    socketRef.current.on('time_extended', (addedTime) => {
      setTimeLeft((prev) => prev + addedTime);
      setHasVoted(false); 
      setPartnerVoted(false);
      setMessages((prev) => [...prev, { sender: 'System', text: '🎉 양측 동의로 대화 시간이 2분 연장되었습니다!' }]);
    });

    return () => { socketRef.current?.disconnect(); };
  }, [selectedLang, selectedTopic]);

  // 5분 타이머
  useEffect(() => {
    if (step !== 'chat' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStep('lobby');
          alert("5분의 대화가 종료되었습니다. 수고하셨습니다!");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // 10초 정적 브레이커 (멀티 모드일 때만 작동)
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
    // 싱글과 멀티 호환을 위해 room, roomId 둘 다 보냄
    socketRef.current?.emit('send_message', { room: room, roomId: room, text: inputText, sender: '나' });
    setInputText('');
    lastInteractionTime.current = Date.now();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {step === 'lobby' ? (
        <div className="text-center max-w-md w-full space-y-8">
          <div className="space-y-2">
            <h1 className="text-5xl font-extrabold tracking-tighter">WE US</h1>
            <p className="text-gray-400">우리가 되어가는 5분의 시간</p>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
            <div className="flex flex-col text-left">
              <label className="text-sm text-gray-400 mb-1 font-bold">🌐 대화 언어</label>
              <select 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value)}
                className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none cursor-pointer"
              >
                <option value="한국어">한국어 (Korean)</option>
                <option value="영어">영어 (English)</option>
                <option value="일본어">일본어 (Japanese)</option>
                <option value="프랑스어">프랑스어 (French)</option>
              </select>
            </div>

            <div className="flex flex-col text-left">
              <label className="text-sm text-gray-400 mb-1 font-bold">🎭 대화 주제</label>
              <select 
                value={selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none cursor-pointer"
              >
                <option value="일상 대화">☕ 일상 대화 (Daily)</option>
                <option value="영화/문화">🍿 영화/문화 (Culture)</option>
                <option value="극단적 밸런스게임">⚖️ 극단적 밸런스게임</option>
                <option value="상황극: 알바생과 진상손님">🤬 상황극: 알바생과 진상손님</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => {
                setIsSingleMode(false);
                setStep('waiting');
                socketRef.current?.emit('join_queue', { lang: selectedLang, topic: selectedTopic }); 
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-600/30"
            >
              낯선 사람과 대화하기 (멀티)
            </button>
            
            {/* ★ 추가된 싱글 모드 버튼 */}
            <button 
              onClick={() => {
                setIsSingleMode(true);
                // 싱글 모드는 대기열 없이 바로 채팅방으로 넘깁니다
                socketRef.current?.emit('start_ai_chat', selectedLang); 
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-all border border-gray-600"
            >
              싱글 모드 (연습하기)
            </button>
          </div>
        </div>
      ) : step === 'waiting' ? (
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mx-auto"></div>
          <p className="text-xl font-bold text-gray-200">누군가를 기다리고 있어요...</p>
          <p className="text-sm text-blue-400 bg-blue-900/30 py-1 px-3 rounded-full inline-block border border-blue-800">
            {selectedLang} / {selectedTopic}
          </p>
        </div>
      ) : (
        <div className="w-full max-w-md h-[80vh] bg-gray-800 rounded-xl flex flex-col shadow-2xl overflow-hidden border border-gray-700 relative">
          <div className="bg-gray-950 p-4 flex justify-between items-center border-b border-gray-700">
            <span className="font-bold text-sm truncate pr-2">
              {isSingleMode ? `싱글 모드: ${selectedLang}` : `주제: ${selectedTopic}`}
            </span>
            <span className={`font-mono text-xl shrink-0 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 pb-20">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === '나' ? 'justify-end' : msg.sender === 'System' ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                  msg.sender === '나' ? 'bg-blue-600 text-white' : 
                  msg.sender === 'System' ? 'bg-gray-700/50 text-gray-300 text-center border border-gray-600' :
                  msg.sender === 'AI 🤖' || msg.sender === 'AI' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'
                }`}>
                  {msg.sender !== 'System' && <span className="text-xs opacity-70 block mb-1">{msg.sender}</span>}
                  <span>{msg.text}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 연장 버튼은 멀티모드이거나, 싱글모드라도 시간이 60초 이하면 띄움 */}
          {timeLeft <= 60 && !isSingleMode && (
            <div className="absolute bottom-[68px] left-0 w-full p-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700 flex flex-col items-center justify-center animate-fade-in-up">
              <button
                onClick={() => {
                  setHasVoted(true);
                  socketRef.current?.emit('vote_extend', { room });
                }}
                disabled={hasVoted}
                className={`px-6 py-2 rounded-full font-bold text-sm shadow-lg transition-all ${
                  hasVoted ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white animate-bounce'
                }`}
              >
                {hasVoted ? '상대방의 동의 대기중...' : '⏱️ 2분 연장하기'}
              </button>
              {partnerVoted && !hasVoted && (
                <span className="mt-2 text-xs text-green-400 font-bold animate-pulse">
                  🔥 상대가 연장을 원해요!
                </span>
              )}
            </div>
          )}

          <form onSubmit={sendMessage} className="p-3 bg-gray-900 border-t border-gray-700 flex gap-2 z-10">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="메시지를 입력하세요..." 
              className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-700 whitespace-nowrap">
              전송
            </button>
          </form>
        </div>
      )}
    </div>
  );
}