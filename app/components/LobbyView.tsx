import React from 'react';

export default function LobbyView({
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic,
  isDropdownOpen, setIsDropdownOpen, isConnecting, isSingleMode, handleMatchStart,
  setStep, factionScores, currentEvent
}: any) {
  
  // ★ 신규: 타일 클릭 시 주제를 세팅하고 즉시 매칭을 시작하는 함수
  const handleDirectMatch = (topic: string, isAi: boolean) => {
    setSelectedTopic(topic);
    // 상태 업데이트 타이밍을 위해 약간의 딜레이 후 실행
    setTimeout(() => {
      handleMatchStart(isAi, topic);
    }, 50);
  };

  return (
    <div className="w-full flex flex-col justify-start space-y-4 sm:space-y-5 flex-1 max-w-sm mx-auto pb-4 pt-2">
      
      <div className="text-center space-y-1 mb-2 shrink-0">
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
          WE US.
        </h1>
        <p className="text-gray-400 font-light tracking-widest text-[9px] sm:text-[10px]">우리가 되어가는 3분의 시간</p>
      </div>

      {currentEvent && (
        <div 
          onClick={() => {
            setSelectedCategory('event');
            setSelectedTopic(currentEvent.topic);
            setStep('role_select');
          }}
          className="w-full relative overflow-hidden bg-gradient-to-r from-purple-900/80 via-fuchsia-900/80 to-blue-900/80 border border-fuchsia-500/50 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(217,70,239,0.3)] shrink-0 group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/20 blur-3xl rounded-full group-hover:bg-fuchsia-500/40 transition-colors"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col text-left">
              <span className="text-[10px] sm:text-xs font-black text-fuchsia-300 tracking-widest mb-1 animate-pulse">
                {currentEvent.desc.split('!')[0] + '!'}
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                {currentEvent.topic}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-white/70 mt-1.5 font-medium">
                실시간 스코어: <span className="font-black text-blue-400">진영A {factionScores?.T || 0}점</span> vs <span className="font-black text-emerald-400">진영B {factionScores?.F || 0}점</span>
              </p>
            </div>
            <div className="text-2xl sm:text-3xl drop-shadow-lg">⚔️</div>
          </div>
        </div>
      )}
      
      {/* ★ 신규: 직관적인 2x2 다이렉트 매칭 아케이드 타일 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0 mt-2">
        <button
          disabled={isConnecting}
          onClick={() => handleDirectMatch('가벼운 스몰토크', false)}
          className="bg-white/[0.03] hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all h-28 sm:h-32 shadow-lg"
        >
          <span className="text-2xl sm:text-3xl mb-2">☕</span>
          <span className="text-xs sm:text-sm font-bold text-white mb-1">일상 라운지</span>
          <span className="text-[8px] sm:text-[9px] text-white/50">가벼운 익명 스몰토크</span>
        </button>

        <button
          disabled={isConnecting}
          onClick={() => handleDirectMatch('무료 원어민 영어 튜터', true)}
          className="bg-white/[0.03] hover:bg-white/10 border border-blue-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all h-28 sm:h-32 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
        >
          <span className="text-2xl sm:text-3xl mb-2">🇺🇸</span>
          <span className="text-xs sm:text-sm font-bold text-blue-300 mb-1">원어민 영어 튜터</span>
          <span className="text-[8px] sm:text-[9px] text-white/50">AI와 실전 회화 (무료)</span>
        </button>

        <button
          disabled={isConnecting}
          onClick={() => handleDirectMatch('자본주의 생존기', false)}
          className="bg-white/[0.03] hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all h-28 sm:h-32 shadow-lg"
        >
          <span className="text-2xl sm:text-3xl mb-2">🍷</span>
          <span className="text-xs sm:text-sm font-bold text-white mb-1">딥 토크 살롱</span>
          <span className="text-[8px] sm:text-[9px] text-white/50">지적이고 깊이 있는 대화</span>
        </button>

        <button
          disabled={isConnecting}
          onClick={() => handleDirectMatch('진상손님 방어전', false)}
          className="bg-white/[0.03] hover:bg-white/10 border border-red-500/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all h-28 sm:h-32 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
        >
          <span className="text-2xl sm:text-3xl mb-2">🎭</span>
          <span className="text-xs sm:text-sm font-bold text-red-300 mb-1">도파민 롤플레잉</span>
          <span className="text-[8px] sm:text-[9px] text-white/50">익명 상황극 서바이벌</span>
        </button>
      </div>

      <div className="pt-2">
        <button 
          onClick={() => setStep && setStep('spectator_list')} 
          className="w-full relative overflow-hidden bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-500/30 text-red-200 hover:from-red-900/60 hover:to-orange-900/60 font-extrabold tracking-wide py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 text-[13px] sm:text-[14px] shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        >
          <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none"></div>
          <span className="text-base sm:text-lg relative z-10">🔥</span> 
          <span className="relative z-10">실시간 콜로세움 관전하기</span>
        </button>
      </div>
      
    </div>
  );
}