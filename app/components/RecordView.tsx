import React from 'react';

export default function RecordView({
  userId, myReports, totalChats, totalChatTime, personaTitle, tier,
  avgLogic, avgLinguistics, avgEmpathy, setActiveTab
}: any) {
  const hasData = myReports.length > 0;

  return (
    <div className="w-full flex flex-col pb-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] text-[#555] tracking-[0.08em] mb-1">MY STATS</p>
          <h2 className="text-xl font-black text-[#f0f0f0]">소통 기록</h2>
        </div>
        <div className="bg-[#1a1a1a] border border-[#333] rounded-[10px] px-3 py-1.5 text-center">
          <p className="text-[9px] text-[#555] tracking-[0.05em]">TIER</p>
          <p className="text-xs font-bold text-[#4ade80]">{tier}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#161616] border border-[#222] rounded-xl p-3">
          <p className="text-[9px] text-[#555] mb-1">누적 대화</p>
          <p className="text-[22px] font-black text-[#f0f0f0] leading-none">
            {totalChats}<span className="text-[11px] text-[#666] font-normal ml-0.5">회</span>
          </p>
        </div>
        <div className="bg-[#161616] border border-[#222] rounded-xl p-3">
          <p className="text-[9px] text-[#555] mb-1">총 대화 시간</p>
          <p className="text-[22px] font-black text-[#f0f0f0] leading-none">
            {totalChatTime < 60
              ? <>{totalChatTime}<span className="text-[11px] text-[#666] font-normal ml-0.5">min</span></>
              : <>{(totalChatTime / 60).toFixed(1)}<span className="text-[11px] text-[#666] font-normal ml-0.5">hrs</span></>
            }
          </p>
        </div>
      </div>

      {/* Communication stats */}
      <div className="bg-[#161616] border border-[#222] rounded-xl p-3 mb-3">
        <p className="text-[9px] text-[#555] tracking-[0.06em] mb-2.5">COMMUNICATION STATS</p>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-semibold text-[#888]">LOGIC</span>
              <span className="text-[10px] text-[#444]">{hasData ? avgLogic : '—'} / 100</span>
            </div>
            <div className="h-1 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full bg-[#F59E0B] rounded-full transition-all" style={{ width: `${hasData ? avgLogic : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-semibold text-[#888]">LINGUISTICS</span>
              <span className="text-[10px] text-[#444]">{hasData ? avgLinguistics : '—'} / 100</span>
            </div>
            <div className="h-1 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full bg-[#8B5CF6] rounded-full transition-all" style={{ width: `${hasData ? avgLinguistics : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-semibold text-[#888]">EMPATHY</span>
              <span className="text-[10px] text-[#444]">{hasData ? avgEmpathy : '—'} / 100</span>
            </div>
            <div className="h-1 bg-[#222] rounded-full overflow-hidden">
              <div className="h-full bg-[#4ade80] rounded-full transition-all" style={{ width: `${hasData ? avgEmpathy : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Empty state CTA or records list */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center text-center py-8 border-t border-[#1a1a1a]">
          <div className="w-12 h-12 rounded-2xl bg-[#0d1a0d] border border-[#1a3a1a] flex items-center justify-center text-2xl mb-2.5">
            🎯
          </div>
          <p className="text-xs font-semibold text-[#ddd] mb-1">아직 기록이 없어요</p>
          <p className="text-[10px] text-[#555] leading-relaxed mb-4">
            첫 대화를 완료하면<br />AI가 소통 스타일을 분석해드려요
          </p>
          <button
            onClick={() => setActiveTab('lobby')}
            className="bg-[#0d1a0d] border border-[#4ade80]/27 rounded-xl px-5 py-2"
          >
            <span className="text-[11px] font-bold text-[#4ade80]">첫 대화 시작하기 →</span>
          </button>
        </div>
      ) : (
        <div className="border-t border-[#1a1a1a] pt-3 space-y-0">
          <h3 className="text-[9px] text-[#555] tracking-[0.06em] mb-2">인사이트 노트</h3>
          {myReports.map((report: any, idx: number) => (
            <div key={idx} className="border-b border-[#1a1a1a] py-3 last:border-0">
              <div className="flex justify-between items-baseline mb-1">
                <span className={`text-[10px] font-bold tracking-widest uppercase ${report.type === 'single' ? 'text-emerald-500/80' : 'text-blue-500/80'}`}>
                  {report.type === 'single' ? `TUTORING · ${report.topic || 'AI'}` : `SALON · ${report.topic}`}
                </span>
                <span className="text-[8px] text-[#444] font-mono">{new Date(report.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-[11px] text-[#888] leading-relaxed whitespace-pre-line">{report.aiReport}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
