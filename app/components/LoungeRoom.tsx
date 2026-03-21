import React, { useState, useEffect, useRef } from 'react';

export default function LoungeRoom({ socketRef, userId, setStep }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [userCount, setUserCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 광장 입장 시 내 유저 ID를 서버로 전송 (닉네임 조회를 위함)
    socketRef.current?.emit('join_lounge', userId);
    
    socketRef.current?.on('init_lounge', (history: any[]) => {
      setMessages(history);
    });

    socketRef.current?.on('new_lounge_message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    // 접속자 수 업데이트 수신
    socketRef.current?.on('lounge_meta', (data: any) => {
      setUserCount(data.userCount);
    });

    return () => {
      socketRef.current?.emit('leave_lounge');
      socketRef.current?.off('init_lounge');
      socketRef.current?.off('new_lounge_message');
      socketRef.current?.off('lounge_meta');
    };
  }, [socketRef, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    socketRef.current?.emit('send_lounge_message', { userId, text: inputText });
    setInputText('');
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0a0a0a]/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/5 relative my-auto mb-4">
      {/* 헤더 */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <span className="font-bold text-white tracking-widest text-[13px]">위어스 오픈광장</span>
          {/* 접속자 수 라이브 뱃지 */}
          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full ml-1 font-bold flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            {userCount}명 접속중
          </span>
        </div>
        <button onClick={() => setStep('lobby')} className="text-[10px] text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">
          나가기
        </button>
      </div>

      {/* 고정 공지사항 (Sticky Notice) */}
      <div className="bg-blue-900/20 border-b border-blue-500/10 p-3 shrink-0 flex items-start gap-2">
        <span className="text-blue-400 text-[13px] mt-0.5">📢</span>
        <p className="text-[10px] text-blue-200/70 leading-relaxed font-medium tracking-wide">
          위어스 오픈광장에 오신 것을 환영합니다.<br/>타인을 배려하는 따뜻하고 다정한 대화를 나누어주세요.
        </p>
      </div>

      {/* 채팅 내역 */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-[11px] tracking-widest">광장에 첫 메시지를 남겨보세요!</div>
        ) : (
          messages.map((msg, idx) => {
            // 시스템 메시지 (입장/퇴장) 렌더링
            if (msg.type === 'system') {
              return (
                <div key={idx} className="flex justify-center my-3">
                  <span className="text-[10px] bg-white/5 px-4 py-1.5 rounded-full text-white/50 tracking-wider">
                    {msg.text}
                  </span>
                </div>
              );
            }

            // 일반 유저 메시지 렌더링
            const isMe = msg.senderId === userId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <span className="text-[10px] text-white/40 mb-1 ml-1 font-bold">{msg.nickname}</span>}
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed break-words ${isMe ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* 입력 폼 */}
      <form onSubmit={sendMessage} className="p-3 bg-[#050505] border-t border-white/5 flex gap-2 shrink-0">
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="모두에게 인사해보세요..." className="flex-1 bg-white/5 text-white px-4 py-3 rounded-xl outline-none text-[13px] focus:bg-white/10 transition-colors" />
        <button type="submit" disabled={!inputText.trim()} className="bg-white text-black px-5 rounded-xl font-bold text-sm disabled:opacity-50">전송</button>
      </form>
    </div>
  );
}