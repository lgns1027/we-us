'use client';
import React, { useState, useEffect } from 'react';

export default function SpectatorList({ socketRef, setStep, setSpectatorRoomId }: any) {
  const [liveRooms, setLiveRooms] = useState<any[]>([]);

  useEffect(() => {
    socketRef.current?.emit('request_live_rooms');

    socketRef.current?.on('receive_live_rooms', (rooms: any[]) => {
      setLiveRooms(rooms);
    });

    // 5초마다 실시간 방 목록 갱신
    const interval = setInterval(() => {
      socketRef.current?.emit('request_live_rooms');
    }, 5000);

    return () => {
      clearInterval(interval);
      socketRef.current?.off('receive_live_rooms');
    };
  }, [socketRef]);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0a0a0a]/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/5 relative p-4 sm:p-6 mb-4 mt-2">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">🔥</span>
          <h2 className="text-sm sm:text-base font-black tracking-widest text-white">콜로세움 관전</h2>
        </div>
        <button onClick={() => setStep('lobby')} className="text-[10px] sm:text-xs bg-white/10 text-white/70 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors">
          로비로 돌아가기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {liveRooms.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-xs tracking-widest text-center leading-relaxed">
            <span className="text-4xl mb-3">🏟️</span>
            현재 진행 중인 토론이 없습니다.<br/>직접 매칭을 시작해 보세요!
          </div>
        ) : (
          liveRooms.map((room, idx) => (
            <div 
              key={idx} 
              onClick={() => {
                setSpectatorRoomId(room.roomId);
                setStep('spectator_room');
              }}
              className="bg-black/50 border border-red-500/20 hover:border-red-500/50 rounded-2xl p-4 cursor-pointer transition-all hover:bg-red-900/10 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-red-500/20 text-red-400 text-[9px] px-2 py-1 rounded-bl-xl font-bold flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                관전자 {room.spectatorCount}명
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white mb-2 pr-16 truncate">{room.topic}</h3>
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-blue-400 font-semibold truncate flex-1">{room.roleA}</span>
                <span className="text-white/30 mx-2 text-[8px] font-black italic">VS</span>
                <span className="text-emerald-400 font-semibold truncate flex-1 text-right">{room.roleB}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}