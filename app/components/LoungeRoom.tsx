import React, { useState, useEffect, useRef } from 'react';

export default function LoungeRoom({ socketRef, userId, setStep }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 광장 입장 및 기존 대화 내역 불러오기
    socketRef.current?.emit('join_lounge');
    
    socketRef.current?.on('init_lounge', (history: any[]) => {
      setMessages(history);
    });

    socketRef.current?.on('new_lounge_message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socketRef.current?.emit('leave_lounge');
      socketRef.current?.off('init_lounge');
      socketRef.current?.off('new_lounge_message');
    };
  }, [socketRef]);

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
    <div className="w-full flex-1 flex flex-col bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 relative my-auto">
      {/* 헤더 */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <span className="font-bold text-white tracking-widest text-sm">오픈 광장</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full ml-2 font-bold animate-pulse">LIVE</span>
        </div>
        <button onClick={() => setStep('lobby')} className="text-[10px] text-white/50 bg-white/5 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">로비로 나가기</button>
      </div>

      {/* 채팅 내역 */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-xs tracking-widest">광장에 첫 메시지를 남겨보세요!</div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === userId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <span className="text-[10px] text-white/40 mb-1 ml-1 font-bold">{msg.nickname}</span>}
                <div className={`max-w-[85%] p-3.5 rounded-xl text-[13px] leading-relaxed break-words ${isMe ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
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
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="모두에게 인사해보세요..." className="flex-1 bg-white/5 text-white px-4 py-3 rounded-xl outline-none text-sm focus:bg-white/10 transition-colors" />
        <button type="submit" disabled={!inputText.trim()} className="bg-white text-black px-5 rounded-xl font-bold text-sm disabled:opacity-50">전송</button>
      </form>
    </div>
  );
}