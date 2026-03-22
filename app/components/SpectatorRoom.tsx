'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function SpectatorRoom({ socketRef, roomId, setStep }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [topic, setTopic] = useState('');
  const [roleA, setRoleA] = useState('');
  const [roleB, setRoleB] = useState('');
  const [spectatorCount, setSpectatorCount] = useState(0);
  
  // ★ 신규: 투표 관련 상태
  const [votesA, setVotesA] = useState(0);
  const [votesB, setVotesB] = useState(0);
  const [isVoteCooldown, setIsVoteCooldown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketRef.current?.emit('join_as_spectator', { roomId });

    socketRef.current?.on('spectator_joined', (data: any) => {
      const formattedHistory = data.history.map((text: string) => {
        const [sender, ...rest] = text.split(': ');
        return { sender: sender.trim(), text: rest.join(': ').trim() };
      });
      setMessages(formattedHistory);
      setTopic(data.topic);
      setRoleA(data.roleA);
      setRoleB(data.roleB);
      setSpectatorCount(data.spectatorCount);
      // 입장 시 현재 누적된 투표수 동기화
      setVotesA(data.votesA || 0);
      setVotesB(data.votesB || 0);
    });

    socketRef.current?.on('receive_message', (data: any) => {
      setMessages(prev => [...prev, { sender: data.sender, text: data.text }]);
    });

    socketRef.current?.on('spectator_count_update', (data: any) => {
      setSpectatorCount(data.count);
    });

    // ★ 신규: 실시간 투표수 업데이트 수신
    socketRef.current?.on('vote_update', (data: any) => {
      setVotesA(data.votesA);
      setVotesB(data.votesB);
    });

    socketRef.current?.on('partner_left', () => {
      setMessages(prev => [...prev, { sender: 'System', text: '대화가 종료되었습니다.' }]);
    });

    return () => {
      socketRef.current?.emit('leave_spectator', { roomId });
      socketRef.current?.off('spectator_joined');
      socketRef.current?.off('receive_message');
      socketRef.current?.off('spectator_count_update');
      socketRef.current?.off('vote_update');
      socketRef.current?.off('partner_left');
    };
  }, [roomId, socketRef]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ★ 투표 전송 함수 (연타 방지 및 선반영 최적화)
  const handleVote = (voteFor: 'A' | 'B') => {
    if (isVoteCooldown) return;
    setIsVoteCooldown(true);
    setTimeout(() => setIsVoteCooldown(false), 300); // 0.3초 쿨타임
    
    // 화면에 먼저 반영해서 빠른 타격감 제공 (Optimistic UI)
    if (voteFor === 'A') setVotesA(prev => prev + 1);
    else setVotesB(prev => prev + 1);

    socketRef.current?.emit('spectator_vote', { roomId, voteFor });
  };

  // 승률 계산 (기본 50:50)
  const totalVotes = votesA + votesB;
  const percentA = totalVotes === 0 ? 50 : Math.round((votesA / totalVotes) * 100);
  const percentB = 100 - percentA;

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

      {/* ★ 신규: 실시간 승률 게이지 바 */}
      <div className="px-4 py-3 bg-[#050505] shrink-0 border-b border-white/5">
        <div className="flex justify-between text-[10px] sm:text-xs font-bold mb-1.5">
          <span className="text-blue-400 truncate pr-2">{roleA} ({percentA}%)</span>
          <span className="text-emerald-400 truncate pl-2">{roleB} ({percentB}%)</span>
        </div>
        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${percentA}%` }}></div>
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${percentB}%` }}></div>
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

      {/* ★ 신규: 실시간 투표 버튼 바 */}
      <div className="p-3 sm:p-4 bg-[#050505] border-t border-red-500/20 shrink-0 flex gap-3 justify-center items-center">
        <button 
          onClick={() => handleVote('A')} 
          className="flex-1 py-3 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-300 rounded-xl font-black text-[11px] sm:text-sm transition-colors active:scale-95 truncate"
        >
          👍 {roleA} 응원
        </button>
        <div className="text-xl sm:text-2xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">🔥</div>
        <button 
          onClick={() => handleVote('B')} 
          className="flex-1 py-3 bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/40 text-emerald-300 rounded-xl font-black text-[11px] sm:text-sm transition-colors active:scale-95 truncate"
        >
          👍 {roleB} 응원
        </button>
      </div>
    </div>
  );
}