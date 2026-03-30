import React, { useRef } from 'react';

const LOBBY_CATEGORIES = [
  { 
    id: 'daily', icon: '☕', title: '일상 라운지', desc: '부담 없는 스몰토크와 편안한 일상 대화', 
    options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'], 
    isAi: false, theme: 'from-[#1e293b]/80 to-[#0f172a]/80', border: 'border-slate-500/30'
  },
  { 
    id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터와 실전 외국어 프리토킹', 
    options: ['원어민 영어 튜터', '일본어 튜터', '프랑스어 튜터', '한국어(외국인용)'], 
    isAi: true, theme: 'from-blue-900/60 to-indigo-900/60', border: 'border-blue-500/30'
  },
  { 
    id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극 서바이벌', 
    options: ['진상손님 방어전', '압박 면접'], 
    isAi: false, theme: 'from-rose-900/60 to-pink-900/60', border: 'border-rose-500/30'
  },
  { 
    id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', 
    options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'], 
    isAi: false, theme: 'from-purple-900/60 to-fuchsia-900/60', border: 'border-purple-500/30'
  }
];

export default function LobbyView({
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic,
  isConnecting, handleMatchStart, setStep, factionScores, currentEvent
}: any) {
  
  const carouselRef = useRef<HTMLDivElement>(null);

  // ★ 카드 내에서 주제를 누르면 상태를 업데이트하고 바로 매칭을 시작하는 함수
  const handleTopicSelectAndStart = (catId: string, topic: string, isAi: boolean) => {
    setSelectedCategory(catId);
    setSelectedTopic(topic);
    // 상태 업데이트 후 자연스럽게 매칭 시작
    setTimeout(() => {
      handleMatchStart(isAi, topic);
    }, 100);
  };

  return (
    <div className="w-full flex flex-col justify-start flex-1 max-w-md mx-auto pb-4 pt-1 relative overflow-hidden">
      
      {/* 상단 헤더 영역 */}
      <div className="text-center space-y-1 mb-4 shrink-0 px-4">
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
          WE US.
        </h1>
        <p className="text-gray-400 font-light tracking-widest text-[9px] sm:text-[10px]">우리가 되어가는 3분의 시간</p>
      </div>

      {/* 데일리 스페셜 이벤트 배너 (서버에서 내려줄 때만 표시) */}
      {currentEvent && (
        <div className="px-4 mb-5 shrink-0">
          <div 
            onClick={() => {
              setSelectedCategory('event');
              setSelectedTopic(currentEvent.topic);
              setStep('role_select');
            }}
            className={`w-full relative overflow-hidden bg-gradient-to-r ${currentEvent.theme || 'from-orange-900/80 to-red-900/80'} border border-white/20 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(239,68,68,0.2)] group`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full group-hover:bg-white/20 transition-colors"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex flex-col text-left">
                <span className="text-[10px] sm:text-xs font-black text-white/80 tracking-widest mb-1 animate-pulse">
                  {currentEvent.desc.split('!')[0] + '!'}
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  {currentEvent.topic}
                </h2>
                {/* 주말 진영전 스코어 등 */}
                {factionScores?.T !== undefined && (
                  <p className="text-[10px] sm:text-[11px] text-white/70 mt-1.5 font-medium">
                    실시간 스코어: <span className="font-black text-blue-400">A {factionScores?.T || 0}점</span> vs <span className="font-black text-emerald-400">B {factionScores?.F || 0}점</span>
                  </p>
                )}
              </div>
              <div className="text-2xl sm:text-3xl drop-shadow-lg">✨</div>
            </div>
          </div>
        </div>
      )}
      
      {/* ★ 신규: 가로 스와이프형 카드 덱 (Horizontal Snap Carousel) */}
      <div className="relative w-full flex-1 min-h-[280px] shrink-0 mb-4">
        <div 
          ref={carouselRef}
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-4 items-stretch [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {LOBBY_CATEGORIES.map((cat) => (
            <div 
              key={cat.id} 
              className={`snap-center shrink-0 w-[85%] sm:w-[80%] rounded-[2rem] p-5 sm:p-6 flex flex-col relative overflow-hidden bg-gradient-to-br ${cat.theme} border ${cat.border} shadow-2xl backdrop-blur-md`}
            >
              {/* 카드 백그라운드 장식 */}
              <div className="absolute -top-10 -right-10 text-8xl opacity-10 blur-sm pointer-events-none">{cat.icon}</div>
              
              {/* 카드 헤더 */}
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <span className="text-3xl sm:text-4xl drop-shadow-md">{cat.icon}</span>
                <div className="flex flex-col text-left">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">{cat.title}</h2>
                  <span className="text-[9px] sm:text-[10px] text-white/60 font-medium">{cat.desc}</span>
                </div>
              </div>

              <div className="w-full h-px bg-white/10 my-3 sm:my-4 relative z-10"></div>

              {/* 세부 주제 퀵 매칭 버튼 리스트 */}
              <div className="flex-1 flex flex-col justify-center space-y-2.5 relative z-10 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                {cat.options.map((opt) => (
                  <button
                    key={opt}
                    disabled={isConnecting}
                    onClick={() => handleTopicSelectAndStart(cat.id, opt, cat.isAi)}
                    className="w-full bg-black/30 hover:bg-black/50 border border-white/5 text-left p-3.5 rounded-xl text-[12px] sm:text-[13px] font-bold text-white/90 transition-all flex justify-between items-center group shadow-sm disabled:opacity-50"
                  >
                    <span className="truncate pr-2">{opt}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-emerald-400 text-lg transition-opacity duration-300">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {/* 스크롤 여백용 가짜 요소 */}
          <div className="snap-center shrink-0 w-2"></div>
        </div>
      </div>

      {/* 하단 관전 버튼 (고정) */}
      <div className="px-4 shrink-0 mt-auto">
        <button 
          onClick={() => setStep && setStep('spectator_list')} 
          className="w-full relative overflow-hidden bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-500/30 text-red-200 hover:from-red-900/60 hover:to-orange-900/60 font-extrabold tracking-wide py-3.5 sm:py-4 rounded-xl transition-all flex justify-center items-center gap-2 text-[13px] sm:text-[14px] shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        >
          <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none"></div>
          <span className="text-base sm:text-lg relative z-10">🔥</span> 
          <span className="relative z-10">실시간 콜로세움 관전하기</span>
        </button>
      </div>
      
    </div>
  );
}