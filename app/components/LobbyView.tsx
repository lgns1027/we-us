'use client';

import React from 'react';

// ★ 대표님의 오리지널 카테고리 구성 보존 (설명글 포함)
const LOBBY_CATEGORIES = [
  { id: 'daily', icon: '☕', title: '일상 라운지', desc: '부담 없는 스몰토크와 편안한 일상 대화', options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'] },
  { id: 'lang', icon: '🌍', title: '어학 튜터링', desc: 'AI 튜터 및 글로벌 유저와 실전 회화', options: ['영어 프리토킹', '오픽/토스 실전 연습', '비즈니스 영어'] },
  { id: 'deep', icon: '🍷', title: '딥 토크 살롱', desc: '일상에서 나누기 힘든 철학적, 지적 대화', options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'] },
  { id: 'roleplay', icon: '🎭', title: '도파민 롤플레잉', desc: '스트레스 해소용 익명 상황극', options: ['진상손님 방어전', '압박 면접', '헤어진 연인과 재회'] }
];

export default function LobbyView({
  selectedCategory, setSelectedCategory, selectedTopic, setSelectedTopic,
  isDropdownOpen, setIsDropdownOpen, isConnecting, isSingleMode, handleMatchStart, setStep // setStep 추가
}: any) {
  
  const currentOptions = LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.options || [];

  return (
    // ★ 화면 상단 여백 확보를 위한 space-y-6 및 max-w-sm 유지
    <div className="w-full flex flex-col justify-center space-y-6 flex-1 min-h-[500px] max-w-sm mx-auto p-1">
      
      {/* 1. 메인 타이틀 영역 (원본 UI 복원) */}
      <div className="text-center space-y-1 mb-2 shrink-0">
        <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg mb-1">
          WE US
        </h1>
        <p className="text-emerald-400 font-light tracking-[0.2em] text-xs">우리가 되어가는 3분의 시간</p>
      </div>

      {/* 2. 카테고리 선택 영역 (간소화 완료) */}
      <div className="bg-[#0a0a0a] backdrop-blur-xl p-4 sm:p-5 rounded-[2rem] border border-white/5 shadow-2xl space-y-4 shrink-0 relative">
        <h2 className="text-[10px] font-bold tracking-[0.2em] text-white/40 mb-2 uppercase text-center">
          어떤 대화를 나눌까요?
        </h2>

        {/* 2x2 그리드, 설명글 제거하여 카드 부피 대폭 축소 */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          {LOBBY_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedTopic(cat.options[0]); 
                setIsDropdownOpen(false); 
              }}
              // ★ p-4를 p-3.5로, rounded-2xl을 rounded-xl로 조정하여 간소화
              className={`p-3 sm:p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border ${
                selectedCategory === cat.id 
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-400' 
                : 'bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-2xl sm:text-3xl mb-1">{cat.icon}</span>
              <span className="text-[11px] sm:text-[12px] font-bold tracking-wider whitespace-nowrap">{cat.title}</span>
              {/* ★ cat.desc 설명글 제거 */}
            </button>
          ))}
        </div>

        {/* 3. 세부 주제 선택 영역 (설명글 재배치) */}
        <div className="flex flex-col text-left space-y-2 pt-2 relative">
          {/* ★ 카드에서 제거한 설명글을 여기에 작고 선명하게 표시 */}
          <label className="text-[9px] sm:text-[10px] text-white/30 tracking-widest font-medium text-center px-1">
            {LOBBY_CATEGORIES.find(c => c.id === selectedCategory)?.desc}
          </label>
          
          <div className="relative pt-1">
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              // ★ p-4를 p-3.5로 조정하여 컴팩트하게
              className="bg-black border border-white/10 text-white text-[13px] font-medium rounded-xl w-full p-3.5 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
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

      {/* 4. 오픈 광장 및 매칭 버튼 영역 (계층 구조 강화) */}
      <div className="space-y-3 shrink-0 pt-1">
        
        {/* ★ 오픈 광장: Full width button으로 배치 (Secondary action) */}
        <button 
          onClick={() => setStep('lounge')} 
          className="w-full py-4 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-blue-200 rounded-[1.2rem] font-bold text-sm tracking-widest transition-all shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:from-blue-900/60 hover:to-indigo-900/60 flex justify-center items-center gap-2"
        >
          <span className="text-lg">🌍</span> 다대다 오픈 광장 입장하기
        </button>

        {/* 오리지널 하단 매칭 시작 버튼 영역 최적화 */}
        <div className="w-full flex gap-3">
          <button 
            disabled={isConnecting}
            onClick={() => handleMatchStart(true)}
            // ★ text-[13px]로 작게, Auxiliary button으로 배치
            className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 font-semibold tracking-wide py-3.5 rounded-[1.2rem] border border-white/10 transition-all flex justify-center items-center gap-2 text-[13px]"
          >
            {isConnecting && isSingleMode ? <div className="w-3 h-3 border-2 border-white/50 border-t-transparent rounded-full animate-spin"/> : null}
            AI 싱글 튜터링연습
          </button>
          
          <button 
            disabled={isConnecting}
            onClick={() => handleMatchStart(false)}
            // ★ text-[14px], Primary button으로 배치 (가장 크고 distinct)
            className="flex-[2] bg-emerald-500/20 text-emerald-300 font-black tracking-wide py-3.5 rounded-[1.2rem] border border-emerald-500/50 hover:bg-emerald-500/30 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] flex justify-center items-center gap-2 text-[14px]"
          >
            {isConnecting && !isSingleMode ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/> : null}
            {isConnecting ? '연결 중...' : '실시간 유저 매칭'}
          </button>
        </div>
      </div>

    </div>
  );
}