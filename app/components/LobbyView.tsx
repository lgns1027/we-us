import React, { useState } from 'react';

const LOBBY_CATEGORIES = [
  { id: 'daily', icon: '☕', title: '일상 라운지', desc: '부담 없는 스몰토크와 편안한 일상 대화', options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'], isAi: false },
  { id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터 및 글로벌 유저와 실전 회화', options: ['무료 원어민 영어 튜터', '일본어 튜터', '프랑스어 튜터', '한국어(외국인용)'], isAi: true },
  { id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'], isAi: false },
  { id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극', options: ['진상손님 방어전', '압박 면접'], isAi: false }
];

export default function LobbyView({
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic,
  isConnecting, handleMatchStart, setStep, factionScores, currentEvent
}: any) {
  
  const [activeModalCat, setActiveModalCat] = useState<any>(null);
  const [clickedTile, setClickedTile] = useState<string | null>(null);

  const openTopicModal = (catId: string) => {
    // 터치 시 쫀득한 애니메이션을 위한 상태 저장
    setClickedTile(catId);
    setTimeout(() => setClickedTile(null), 200);

    const cat = LOBBY_CATEGORIES.find(c => c.id === catId);
    if (cat) setActiveModalCat(cat);
  };

  const handleTopicSelectAndStart = (topic: string, isAi: boolean) => {
    setSelectedCategory(activeModalCat.id);
    setSelectedTopic(topic);
    setActiveModalCat(null);
    setTimeout(() => {
      handleMatchStart(isAi, topic);
    }, 100);
  };

  return (
    <div className="w-full flex flex-col justify-start space-y-4 sm:space-y-5 flex-1 max-w-sm mx-auto pb-4 pt-2 relative">
      
      {/* 로비 타이틀 영역 */}
      <div className="text-center space-y-1 mb-2 shrink-0 animate-fade-in-up">
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
          WE US.
        </h1>
        <p className="text-gray-400 font-light tracking-widest text-[9px] sm:text-[10px]">우리가 되어가는 3분의 시간</p>
      </div>

      {/* 데일리 스페셜 이벤트 배너 */}
      {currentEvent && (
        <div 
          onClick={() => {
            setSelectedCategory('event');
            setSelectedTopic(currentEvent.topic);
            setStep('role_select');
          }}
          className={`w-full relative overflow-hidden bg-gradient-to-r ${currentEvent.theme || 'from-purple-900/80 to-blue-900/80'} border border-white/20 rounded-2xl p-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-2xl shrink-0 group`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full group-hover:bg-white/20 transition-colors"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col text-left">
              <span className="text-[10px] sm:text-xs font-black text-white/80 tracking-widest mb-1 animate-pulse">
                {currentEvent.desc.split('!')[0] + '!'}
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide group-hover:translate-x-1 transition-transform duration-300">
                {currentEvent.topic}
              </h2>
            </div>
            <div className="text-2xl sm:text-3xl drop-shadow-lg group-hover:rotate-12 transition-transform duration-300">✨</div>
          </div>
        </div>
      )}
      
      {/* 2x2 카테고리 타일 그리드 (역동적인 모션 적용) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0 mt-2">
        {LOBBY_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            disabled={isConnecting}
            onClick={() => openTopicModal(cat.id)}
            className={`group bg-white/[0.03] hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 h-28 sm:h-32 shadow-lg relative overflow-hidden 
              ${clickedTile === cat.id ? 'scale-90 opacity-70' : 'active:scale-95'}
            `}
          >
            {/* 아이콘 둥둥 뜨는 모션 */}
            <span className="text-2xl sm:text-3xl mb-2 relative z-10 transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-110">
              {cat.icon}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white mb-1 relative z-10 transition-colors group-hover:text-emerald-300">
              {cat.title}
            </span>
            <span className="text-[8px] sm:text-[9px] text-white/50 relative z-10">
              {cat.desc.split(' ')[0]} {cat.desc.split(' ')[1]}
            </span>
          </button>
        ))}
      </div>

      {/* 관전 버튼 */}
      <div className="pt-2">
        <button 
          onClick={() => setStep && setStep('spectator_list')} 
          className="w-full relative overflow-hidden bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-500/30 text-red-200 hover:from-red-900/60 hover:to-orange-900/60 font-extrabold tracking-wide py-3.5 rounded-xl transition-all active:scale-95 duration-200 flex justify-center items-center gap-2 text-[13px] sm:text-[14px] shadow-[0_0_15px_rgba(239,68,68,0.2)] group"
        >
          <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none"></div>
          <span className="text-base sm:text-lg relative z-10 group-hover:animate-bounce">🔥</span> 
          <span className="relative z-10">실시간 콜로세움 관전하기</span>
        </button>
      </div>

      {/* ★ 세부 주제 선택 바텀 시트 모달 (스무스 업 애니메이션 적용) */}
      {activeModalCat && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div 
            className="bg-[#111] w-full max-w-lg mx-auto rounded-t-3xl border-t border-x border-white/10 p-6 pb-28 flex flex-col max-h-[85vh] animate-[slide-up_0.3s_ease-out_forwards]"
            style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl animate-bounce" style={{ animationIterationCount: 1.5 }}>{activeModalCat.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">{activeModalCat.title}</h3>
                  <p className="text-[10px] text-white/50">{activeModalCat.desc}</p>
                </div>
              </div>
              <button onClick={() => setActiveModalCat(null)} className="text-white/40 hover:text-white hover:rotate-90 transition-transform text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full bg-white/5">✕</button>
            </div>
            
            {/* 리스트 아이템 순차적 등장 애니메이션 */}
            <div className="space-y-3 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden pb-4">
              {activeModalCat.options.map((opt: string, index: number) => (
                <button
                  key={opt}
                  onClick={() => handleTopicSelectAndStart(opt, activeModalCat.isAi)}
                  className="w-full group bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 hover:border-emerald-500/30 text-left p-4 rounded-xl text-sm font-semibold text-white/90 transition-all duration-200 flex justify-between items-center shrink-0 opacity-0 animate-[fade-in-up_0.4s_ease-out_forwards]"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="group-hover:translate-x-1 transition-transform duration-200">{opt}</span>
                  <span className="text-emerald-400 text-[10px] font-bold px-3 py-1.5 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                    START 🚀
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Tailwind 커스텀 애니메이션 정의용 Style 태그 */}
          <style dangerouslySetContent={{__html: `
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}} />
        </div>
      )}
      
    </div>
  );
}