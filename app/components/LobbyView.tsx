import React from 'react';

const LOBBY_CATEGORIES = [
  { id: 'daily', icon: '☕', title: '일상 라운지', desc: '부담 없는 스몰토크와 편안한 일상 대화', options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'] },
  { id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터 및 글로벌 유저와 실전 회화', options: ['영어', '일본어', '프랑스어', '한국어(외국인용)'] },
  { id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'] },
  { id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극', options: ['진상손님 방어전', '압박 면접'] }
];

export default function LobbyView({
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic,
  isDropdownOpen, setIsDropdownOpen, isConnecting, isSingleMode, handleMatchStart,
  setStep // ★ 추가: 광장으로 넘어가기 위해 setStep을 Props로 받음
}: any) {
  const currentOptions = LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.options || [];

  return (
    <div className="w-full flex flex-col justify-center space-y-6 flex-1 min-h-[500px]">
      <div className="text-center space-y-1 mb-1 shrink-0">
        <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
          WE US.
        </h1>
        <p className="text-gray-400 font-light tracking-widest text-[10px]">우리가 되어가는 3분의 시간</p>
      </div>
      
      <div className="grid grid-cols-2 gap-2 shrink-0">
        {LOBBY_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setSelectedTopic(cat.options[0]); 
              setIsDropdownOpen(false); 
            }}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${
              selectedCategory === cat.id 
              ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
              : 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-100'
            }`}
          >
            <span className="text-xl mb-1">{cat.icon}</span>
            <span className="text-[10px] font-bold tracking-wider text-white whitespace-nowrap">{cat.title}</span>
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl space-y-4 shrink-0">
        <div className="flex flex-col text-left space-y-2 relative">
          <label className="text-[11px] text-emerald-400 uppercase tracking-widest font-bold">
            {LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.desc}
          </label>
          <div className="relative">
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-[#0a0a0a] border border-white/10 text-white text-[14px] rounded-xl w-full p-3.5 flex justify-between items-center cursor-pointer hover:border-white/30 transition-colors"
            >
              <span>{selectedTopic}</span>
              <span className={`transition-transform duration-200 text-white/50 text-[10px] ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>
            {isDropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-[#0a0a0a] border border-emerald-500/30 rounded-xl overflow-hidden z-50 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col divide-y divide-white/5">
                {currentOptions.map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { setSelectedTopic(opt); setIsDropdownOpen(false); }}
                    className={`p-3 text-left text-[13px] transition-colors w-full ${
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

        <div className="space-y-2 pt-1">
          {/* ★ 변경점: 오픈 광장 버튼 추가 (기존 AI 연습 버튼 삭제) */}
          <button 
            onClick={() => setStep && setStep('lounge')} 
            className="w-full bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-blue-200 hover:from-blue-900/60 hover:to-indigo-900/60 font-extrabold tracking-wide py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 text-[14px] shadow-[0_0_15px_rgba(59,130,246,0.15)]"
          >
            <span className="text-lg">🌍</span> 다대다 오픈 광장 입장하기
          </button>
          
          <button 
            disabled={isConnecting}
            onClick={() => handleMatchStart(false)}
            className="w-full bg-white text-black font-extrabold tracking-wide py-3.5 rounded-xl hover:bg-gray-200 transition-all shadow-lg flex justify-center items-center gap-2 text-[14px]"
          >
            {isConnecting && !isSingleMode ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"/> : null}
            익명 매칭 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}