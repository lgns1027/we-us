import React from 'react';

export default function ProfileView({ userId, tier, personaTitle }: any) {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center space-y-6 pb-[80px]">
      <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-4xl mb-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
        👤
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-widest text-white">{userId}</h2>
        <p className="text-emerald-400 text-sm mt-2 font-medium">{personaTitle} <span className="text-white/50">({tier})</span></p>
      </div>

      <div className="w-full bg-white/[0.02] p-6 rounded-3xl border border-white/5 text-center mt-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">🤝</span>
          <p className="text-white/70 text-sm font-bold tracking-widest">인사이트 인맥 (친구 목록)</p>
        </div>
        <p className="text-white/30 text-xs mt-3 leading-relaxed">
          대화가 잘 통했던 파트너를 친구로 추가하는 기능은 <br/> V2 익명 콜로세움 업데이트 시 오픈됩니다.
        </p>
      </div>
    </div>
  );
}