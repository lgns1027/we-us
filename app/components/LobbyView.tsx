import React from 'react';

const CATEGORIES = [
  { id: 'daily', name: '일상 라운지', icon: '☕' },
  { id: 'language', name: '어학 튜터링', icon: '🌎' },
  { id: 'debate', name: '심야 토론장', icon: '🔥' },
  { id: 'roleplay', name: '상황극/면접', icon: '🎭' }
];

const TOPICS: Record<string, string[]> = {
  'daily': ['가벼운 스몰토크', '요즘 보는 넷플릭스/유튜브', '최악의 이불킥 경험', 'MBTI 과몰입 토크', '퇴사 마려운 순간'],
  'language': ['영어 프리토킹', '오픽/토스 실전 연습', '비즈니스 영어 이메일', '해외여행 생존 회화', '팝송 가사 해석하기'],
  'debate': ['100억 받기 VS 무병장수', '자본주의 생존기', '연인 사이 폰 공유 가능?', '깻잎 논쟁 종결', '평생 라면 VS 평생 치킨'],
  'roleplay': ['압박 면접', '진상손님 방어전', '중고거래 네고하기', '헤어진 연인과 재회', '팀플 무임승차 대처']
};

export default function LobbyView({ 
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic, 
  isDropdownOpen, setIsDropdownOpen, isConnecting, isSingleMode, handleMatchStart 
}: any) {
  
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-8 w-full max-w-sm mx-auto">
      
      {/* 1. 메인 타이틀 영역 (간격 벌림) */}
      {/* ★ 변경점: mb-12 를 적용하여 아래 카테고리 영역과의 간격을 시원하게 벌렸습니다. */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black mb-3 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          WE US
        </h1>
        <p className="text-xs font-medium text-emerald-400 tracking-[0.3em] uppercase">
          우리가 되어가는 3분의 시간
        </p>
      </div>

      {/* 2. 카테고리 선택 영역 */}
      <div className="w-full bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 shadow-2xl relative mb-6">
        <h2 className="text-[10px] font-bold tracking-[0.2em] text-white/40 mb-4 uppercase text-center">
          어떤 대화를 나눌까요?
        </h2>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setSelectedTopic(TOPICS[cat.id][0]); setIsDropdownOpen(false); }}
              className={`py-3.5 px-2 rounded-2xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-2 border ${
                selectedCategory === cat.id 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                  : 'bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="tracking-wider">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* 3. 세부 주제 선택 (드롭다운) */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full bg-black border border-white/10 p-4 rounded-xl text-sm font-medium text-white flex justify-between items-center hover:bg-white/[0.02] transition-colors"
          >
            <span className="truncate pr-4">{selectedTopic}</span>
            <span className="text-emerald-400 text-xs shrink-0">변경 ▼</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-black/95 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {TOPICS[selectedCategory].map((topic) => (
                <button
                  key={topic}
                  onClick={() => { setSelectedTopic(topic); setIsDropdownOpen(false); }}
                  className={`w-full text-left p-4 text-sm transition-colors border-b border-white/5 last:border-0 ${
                    selectedTopic === topic ? 'bg-emerald-500/10 text-emerald-300 font-bold' : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. 매칭 시작 버튼 영역 */}
      <div className="w-full flex gap-3">
        <button 
          onClick={() => handleMatchStart(true)} 
          disabled={isConnecting}
          className="flex-1 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-[1.5rem] font-bold text-sm tracking-widest transition-all disabled:opacity-50"
        >
          AI 싱글 튜터링
        </button>
        <button 
          onClick={() => handleMatchStart(false)} 
          disabled={isConnecting}
          className="flex-[2] py-4 bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 rounded-[1.5rem] font-black text-sm tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] disabled:opacity-50"
        >
          {isConnecting ? '연결 중...' : '실시간 유저 매칭'}
        </button>
      </div>

    </div>
  );
}