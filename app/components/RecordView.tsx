import React from 'react';

export default function RecordView({
  userId, myReports, totalPlayHours, personaTitle, personaDesc, tier, avgLogic, avgLinguistics, avgEmpathy
}: any) {
  return (
    // ★ 변경점: 수직 중앙 정렬을 위한 래퍼 추가
    <div className="w-full flex flex-col justify-center my-auto py-6">
      <div className="w-full bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 flex flex-col shadow-2xl relative mb-6">
        <div className="flex justify-between items-end mb-6 shrink-0">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.3em] text-white/50 mb-1">ANALYTICS</h2>
            <p className="text-[10px] text-white/30 tracking-widest truncate max-w-[150px]">{userId}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">{tier}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6 shrink-0">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-white/40 tracking-widest uppercase mb-1">누적 자산</span>
            <span className="text-xl font-light text-white">{totalPlayHours}<span className="text-[10px] text-white/30 ml-1">hrs</span></span>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-white/40 tracking-widest uppercase mb-1">페르소나</span>
            <span className="text-xs font-semibold text-emerald-300">{personaTitle}</span>
          </div>
        </div>

        <div className="space-y-4 mb-6 shrink-0">
          <div>
            <div className="flex justify-between text-[10px] font-medium text-white/60 mb-1 uppercase tracking-wider"><span>Logic</span><span>{myReports.length > 0 ? avgLogic : '-'} / 100</span></div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all" style={{ width: `${myReports.length > 0 ? avgLogic : 0}%` }}></div></div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-medium text-white/60 mb-1 uppercase tracking-wider"><span>Linguistics</span><span>{myReports.length > 0 ? avgLinguistics : '-'} / 100</span></div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${myReports.length > 0 ? avgLinguistics : 0}%` }}></div></div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-medium text-white/60 mb-1 uppercase tracking-wider"><span>Empathy</span><span>{myReports.length > 0 ? avgEmpathy : '-'} / 100</span></div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all" style={{ width: `${myReports.length > 0 ? avgEmpathy : 0}%` }}></div></div>
          </div>
        </div>

        <div className="flex-1 space-y-0 -mx-4 px-4 pb-2">
          <h3 className="text-[10px] text-white/30 tracking-widest uppercase mb-2 py-1">인사이트 노트</h3>
          {myReports.length === 0 ? (
            <div className="text-center pt-6"><p className="text-xs text-white/30 tracking-widest">데이터가 없습니다.</p></div>
          ) : (
            myReports.map((report: any, idx: number) => (
              <div key={idx} className="border-b border-white/5 py-4 last:border-0 group cursor-pointer">
                <div className="flex justify-between items-baseline mb-1">
                  <span className={`text-[10px] font-bold tracking-widest uppercase ${report.type === 'single' ? 'text-emerald-500/80' : 'text-blue-500/80'}`}>
                    {report.type === 'single' ? `TUTORING • ${report.topic || 'AI'}` : `SALON • ${report.topic}`}
                  </span>
                  <span className="text-[8px] text-white/20 font-mono">{new Date(report.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed whitespace-pre-line group-hover:text-white transition-colors">{report.aiReport}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}