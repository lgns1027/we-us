import React, { useState } from 'react';

const LOBBY_CATEGORIES = [
  {
    id: 'daily', icon: '☕', title: '일상 라운지',
    desc: '부담 없는 스몰토크와 편안한 일상 대화', shortDesc: '부담 없는',
    options: ['가벼운 스몰토크', '오늘 하루의 하이라이트', '요즘 꽂힌 취미 이야기'],
    isAi: false,
    borderCls: 'border-l-amber-400',
    badgeCls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  },
  {
    id: 'lang', icon: '🌍', title: '어학 튜터링',
    desc: 'AI 튜터 및 글로벌 유저와 실전 회화', shortDesc: 'AI 튜터',
    options: ['원어민 영어 튜터', '일본어 튜터', '프랑스어 튜터', '한국어(외국인용)'],
    isAi: true,
    borderCls: 'border-l-sky-400',
    badgeCls: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  },
  {
    id: 'deep', icon: '🍷', title: '딥토크 살롱',
    desc: '일상에서 나누기 힘든 철학적, 지적 대화', shortDesc: '철학·가치관',
    options: ['최악의 이불킥 경험', '자본주의 생존기', '100억 받기 VS 무병장수'],
    isAi: false,
    borderCls: 'border-l-purple-400',
    badgeCls: 'bg-white/10 text-white/50 border border-white/10',
  },
  {
    id: 'roleplay', icon: '🎭', title: '도파민 롤플레이',
    desc: '스트레스 해소용 익명 상황극', shortDesc: '스트레스 해소',
    options: ['진상손님 방어전', '압박 면접'],
    isAi: false,
    borderCls: 'border-l-rose-400',
    badgeCls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  },
];

interface LobbyViewProps {
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedTopic: string;
  setSelectedTopic: (t: string) => void;
  isConnecting: boolean;
  handleMatchStart: (isAi: boolean, topic?: string) => void;
  setStep: (s: string) => void;
  factionScores: any;
  currentEvent: any;
  myReports: any[];
  // New dopamine-hook props (with safe defaults so existing page.tsx callers still work)
  onlineCount?: number;
  eventParticipants?: number;
  queueCounts?: { daily?: number; lang?: number; deep?: number; roleplay?: number };
  liveRoomCount?: number;
  spectatorCount?: number;
}

export default function LobbyView({
  selectedCategory: _selectedCategory, setSelectedCategory, selectedTopic: _selectedTopic, setSelectedTopic,
  isConnecting, handleMatchStart, setStep, factionScores: _factionScores, currentEvent, myReports: _myReports,
  onlineCount = 247,
  eventParticipants = 38,
  queueCounts = { daily: 89, lang: 0, deep: 43, roleplay: 31 },
  liveRoomCount = 12,
  spectatorCount = 84,
}: LobbyViewProps) {

  const [activeModalCat, setActiveModalCat] = useState<any>(null);
  const [clickedTile, setClickedTile] = useState<string | null>(null);

  const openTopicModal = (catId: string) => {
    setClickedTile(catId);
    setTimeout(() => setClickedTile(null), 200);
    const cat = LOBBY_CATEGORIES.find(c => c.id === catId);
    if (cat) setActiveModalCat(cat);
  };

  const handleTopicSelectAndStart = (topic: string, isAi: boolean) => {
    setSelectedCategory(activeModalCat.id);
    setSelectedTopic(topic);
    setActiveModalCat(null);
    setTimeout(() => handleMatchStart(isAi, topic), 100);
  };

  const getQueueBadge = (cat: typeof LOBBY_CATEGORIES[0]) => {
    if (cat.isAi) return { text: 'AI 즉시매칭', cls: cat.badgeCls };
    const count = (queueCounts as any)[cat.id] ?? 0;
    return { text: `${count}명 대기`, cls: cat.badgeCls };
  };

  return (
    <div className="w-full flex flex-col justify-start space-y-3 sm:space-y-4 flex-1 max-w-sm mx-auto pb-4 pt-2 relative">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
            WE US.
          </h1>
          <p className="text-gray-400 font-light tracking-widest text-[9px] sm:text-[10px]">
            우리가 되어가는 3분의 시간
          </p>
        </div>

        {/* Live counter */}
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-semibold text-white/80 whitespace-nowrap">
            {onlineCount.toLocaleString()}명 대화중
          </span>
        </div>
      </div>

      {/* ── Daily Special Event Banner ─────────────────────── */}
      {currentEvent && (
        <div className={`w-full relative overflow-hidden bg-gradient-to-br ${currentEvent.theme || 'from-[#18104a] to-[#0c0828]'} border border-purple-500/30 rounded-2xl p-4 shadow-[0_0_28px_rgba(139,92,246,0.12)] shrink-0`}>
          {/* Sparkle decoration */}
          <div className="absolute top-3 right-3 text-white/50 text-xl select-none pointer-events-none">✦✦</div>

          <div className="relative z-10">
            <p className="text-[10px] font-black text-purple-300/80 tracking-widest mb-2 uppercase">
              {currentEvent.desc ? currentEvent.desc.split('!')[0] : '오늘의 한정 큐'}
            </p>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl shrink-0">✨</span>
                  <h2 className="text-[15px] sm:text-base font-extrabold text-white tracking-wide truncate">
                    {currentEvent.topic}
                  </h2>
                </div>
                <p className="text-[10px] text-white/45">
                  자정까지 · 지금 {eventParticipants}명 참여중
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCategory('event');
                  setSelectedTopic(currentEvent.topic);
                  setStep('role_select');
                }}
                className="shrink-0 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl transition-all duration-200 whitespace-nowrap"
              >
                지금 참여 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2×2 Category Grid ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 shrink-0">
        {LOBBY_CATEGORIES.map(cat => {
          const badge = getQueueBadge(cat);
          return (
            <button
              key={cat.id}
              disabled={isConnecting}
              onClick={() => openTopicModal(cat.id)}
              className={`group bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/[0.08] border-l-4 ${cat.borderCls} rounded-2xl p-4 flex flex-col items-start text-left transition-all duration-300 h-28 sm:h-32 shadow-lg relative overflow-hidden
                ${clickedTile === cat.id ? 'scale-90 opacity-60' : 'active:scale-95'}
              `}
            >
              <span className="text-2xl mb-1.5 relative z-10 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 leading-none">
                {cat.icon}
              </span>
              <span className="text-[13px] sm:text-sm font-bold text-white relative z-10 leading-snug">
                {cat.title}
              </span>
              <span className="text-[9px] text-white/40 relative z-10 mb-auto">{cat.shortDesc}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full relative z-10 mt-1.5 ${badge.cls}`}>
                {badge.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Live Spectate Section ──────────────────────────── */}
      <div className="shrink-0">
        <div className="w-full relative overflow-hidden bg-gradient-to-r from-[#1c0800] to-[#2d0e00] border border-orange-800/40 rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-[0_0_20px_rgba(234,88,12,0.08)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base leading-none">🔥</span>
              <span className="text-[13px] font-extrabold text-white">실시간 콜로세움</span>
            </div>
            <p className="text-[10px] text-white/45">
              {liveRoomCount}개 방 진행 중 · {spectatorCount}명 관전
            </p>
          </div>
          <button
            onClick={() => setStep && setStep('spectator_list')}
            className="shrink-0 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white text-[13px] font-bold px-5 py-2 rounded-xl transition-all duration-200"
          >
            관전
          </button>
        </div>
      </div>

      {/* ── Bottom Sheet Modal ─────────────────────────────── */}
      {activeModalCat && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}
        >
          <div
            className="bg-[#111] w-full max-w-lg mx-auto rounded-t-3xl border-t border-x border-white/10 p-6 pb-6 flex flex-col max-h-[85vh]"
            style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeModalCat.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">{activeModalCat.title}</h3>
                  <p className="text-[10px] text-white/50">{activeModalCat.desc}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalCat(null)}
                className="text-white/40 hover:text-white hover:rotate-90 transition-transform text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full bg-white/5"
              >
                ✕
              </button>
            </div>

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

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to   { transform: translateY(0); }
            }
            @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          ` }} />
        </div>
      )}

    </div>
  );
}
