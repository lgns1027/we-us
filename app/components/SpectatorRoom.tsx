'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function SpectatorRoom({ socketRef, roomId, setStep }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [topic, setTopic] = useState('');
  const [roleA, setRoleA] = useState('');
  const [roleB, setRoleB] = useState('');
  const [spectatorCount, setSpectatorCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketRef.current?.emit('join_as_spectator', { roomId });

    socketRef.current?.on('spectator_joined', (data: any) => {
      // 기존 히스토리를 메시지 객체로 예쁘게 변환
      const formattedHistory = data.history.map((text: string) => {
        const [sender, ...rest] = text.split(': ');
        return { sender: sender.trim(), text: rest.join(': ').trim() };
      });
      setMessages(formattedHistory);
      setTopic(data.topic);
      setRoleA(data.roleA);
      setRoleB(data.roleB);
      setSpectatorCount(data.spectatorCount);
    });

    socketRef.current?.on('receive_message', (data: any) => {
      setMessages(prev => [...prev, { sender: data.sender, text: data.text }]);
    });

    socketRef.current?.on('spectator_count_update', (data: any) => {
      setSpectatorCount(data.count);
    });

    socketRef.current?.on('partner_left', () => {
      setMessages(prev => [...prev, { sender: 'System', text: '대화가 종료되었습니다.' }]);
    });

    return () => {
      socketRef.current?.emit('leave_spectator', { roomId });
      socketRef.current?.off('spectator_joined');
      socketRef.current?.off('receive_message');
      socketRef.current?.off('spectator_count_update');
      socketRef.current?.off('partner_left');
    };
  }, [roomId, socketRef]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-full flex-1 mb-4 bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[2rem] flex flex-col shadow-2xl overflow-hidden border border-red-500/20 relative mt-2">
      {/* 관전 헤더 */}
      <div className="bg-red-950/30 p-3 sm:p-4 flex justify-between items-center border-b border-red-500/10 shrink-0">
        <div className="flex flex-col gap-1 pr-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="font-bold text-[11px] sm:text-xs text-red-100 truncate">관전 중: {topic}</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-white/50 truncate font-medium">{roleA} vs {roleB}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[9px] sm:text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30 font-bold">
            👁️ {spectatorCount}명
          </span>
          <button onClick={() => setStep('spectator_list')} className="text-[9px] sm:text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-md text-white/60 hover:text-white transition-colors">
            나가기
          </button>
        </div>
      </div>

      {/* 남들의 채팅 내역 */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((msg: any, idx: number) => {
          const isSystem = msg.sender === 'System';
          const isRoleA = msg.sender === roleA;
          return (
            <div key={idx} className={`flex ${isSystem ? 'justify-center' : isRoleA ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] p-3 sm:p-3.5 rounded-2xl text-[12px] sm:text-[13px] leading-relaxed break-words ${
                isSystem ? 'bg-white/5 text-white/50 text-center text-[10px] border border-white/10 w-full' :
                isRoleA ? 'bg-blue-900/20 border border-blue-500/30 text-blue-100 rounded-tl-sm' : 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-100 rounded-tr-sm'
              }`}>
                {!isSystem && <span className={`text-[9px] sm:text-[10px] block mb-1 font-black tracking-wide ${isRoleA ? 'text-blue-400' : 'text-emerald-400'}`}>{msg.sender}</span>}
                <span className="whitespace-pre-line">{msg.text}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Phase 2를 위한 하단 리액션 바 */}
      <div className="p-3 bg-[#050505] border-t border-red-500/20 shrink-0 flex gap-2 justify-center items-center">
        <div className="text-[10px] sm:text-xs text-white/30 font-bold tracking-widest text-center py-2 animate-pulse">
          실시간 리액션 및 투표 기능이 준비 중입니다 🍿
        </div>
      </div>
    </div>
  );
}