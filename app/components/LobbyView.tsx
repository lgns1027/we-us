import React from 'react';

const LOBBY_CATEGORIES = [
  { id: 'daily', icon: '☕', title: '일상 라운지', desc: '부담 없는 스몰토크와 편안한 일상 대화', options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'] },
  { id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터 및 글로벌 유저와 실전 회화', options: ['영어', '일본어', '프랑스어', '한국어(외국인용)'] },
  { id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'] },
  { id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극', options: ['진상손님 방어전', '압박 면접'] }
];

export default function LobbyView({
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic,
  isDropdownOpen, setIsDropdownOpen, isConnecting, handleMatchStart, setStep 
}: any) {
  
  const currentOptions = LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.options || [];

  return (
    // 상단 잘림 방지를 위해 flex-1만 사용하고 불필요한 중앙 정렬을 뺌
    <div className="w-full flex flex-col space-y-6 flex-1 max-w-sm mx-auto pb-4">
      
      {/* 1. 메인 타이틀 영역 (색상 및 디자인 완벽 복원) */}
      <div className="text-center space-y-1 mb-2 shrink-0">
        <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500 drop-shadow-lg mb-1">
          WE US.
        </h1>
        <p className="text-emerald-400 font-light tracking-[0.2em] text-[11px]">우리가 되어가는 3분의 시간</p>
      </div>

      <div className="bg-[#0a0a0a] backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 shadow-2xl space-y-4 shrink-0 relative">
        <h2 className="text-[10px] font-bold tracking-[0.2em] text-white/40 mb-2 uppercase text-center">
          어떤 대화를 나눌까요?
        </h2>

        <div className="grid grid-cols-2 gap-3 shrink-0">
          {LOBBY_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedTopic(cat.options[0]); 
                setIsDropdownOpen(false); 
              }}
              className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border ${
                selectedCategory === cat.id 
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-400' 
                : 'bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-2xl mb-1">{cat.icon}</span>
              <span className="text-[11px] font-bold tracking-wider whitespace-nowrap">{cat.title}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col text-left space-y-3 pt-2 relative">
          <label className="text-[10px] text-white/40 tracking-widest font-medium text-center px-2">
            {LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.desc}
          </label>
          
          <div className="relative">
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-black border border-white/10 text-white text-[13px] font-bold rounded-xl w-full p-4 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
            >
              <span>{selectedTopic}</span>
              <span className={`transition-transform duration-200 text-emerald-400 text-xs ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>
            
            {isDropdownOpen && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl flex flex-col divide-y divide-white/5 max-h-[180px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {currentOptions.map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { setSelectedTopic(opt); setIsDropdownOpen(false); }}
                    className={`p-4 text-left text-[13px] transition-colors w-full ${
                      selectedTopic === opt ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 버튼 영역 */}
      <div className="space-y-3 shrink-0">
        <button 
          onClick={() => setStep('lounge')} 
          className="w-full bg-[#0f172a] hover:bg-[#1e3a8a] text-blue-200 font-extrabold tracking-widest py-3.5 rounded-xl border border-blue-500/30 transition-all shadow-lg flex justify-center items-center gap-2 text-[14px]"
        >
          <span className="text-lg">🌍</span> 다대다 오픈 광장 입장하기
        </button>

        {/* ★ AI 버튼은 삭제하고 유저 매칭 버튼만 하얗고 예쁘게 꽉 채움 */}
        <button 
          disabled={isConnecting}
          onClick={() => handleMatchStart(false)}
          className="w-full bg-white text-black font-extrabold tracking-wide py-3.5 rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] flex justify-center items-center gap-2 text-[14px]"
        >
          {isConnecting ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"/> : null}
          {isConnecting ? '매칭 중...' : '익명 매칭 시작하기'}
        </button>
      </div>

    </div>
  );
}