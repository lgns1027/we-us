'use client';

import React, { useState, useEffect } from 'react';

export default function ProfileView({ userId, tier, personaTitle, socketRef }: any) {
  const [nickname, setNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);

  useEffect(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('get_profile', userId);
      socketRef.current.on('receive_profile', (data: any) => {
        setNickname(data.nickname);
        setFriendsList(Array.isArray(data.friends) ? data.friends : []);
      });
    }
    return () => { socketRef.current?.off('receive_profile'); };
  }, [userId, socketRef]);

  const handleSaveNickname = () => {
    if (editInput.trim() === '') return alert("닉네임을 입력해주세요.");
    socketRef.current?.emit('update_nickname', { userId, nickname: editInput });
    setIsEditing(false);
  };

  const safeFriendsList = Array.isArray(friendsList) ? friendsList : [];

  return (
    <div className="w-full flex flex-col h-full bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 shadow-2xl relative mb-6">
      <div className="flex flex-col items-center justify-center space-y-4 pb-6 border-b border-white/10 shrink-0 mt-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-white/20 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(16,185,129,0.15)]">🎭</div>
        <div className="text-center w-full px-4">
          {isEditing ? (
            <div className="flex items-center justify-center gap-2 mt-2">
              <input type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)} maxLength={10} className="bg-black border border-emerald-500/50 text-white text-center rounded-lg px-3 py-1.5 w-32 outline-none focus:border-emerald-400 text-sm" autoFocus />
              <button onClick={handleSaveNickname} className="bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-400">저장</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-2">
              <h2 className="text-2xl font-black tracking-wider text-white truncate max-w-[200px]">{nickname || '로딩중...'}</h2>
              <button onClick={() => { setEditInput(nickname); setIsEditing(true); }} className="text-white/40 hover:text-white/80 text-sm">✏️</button>
            </div>
          )}
          <p className="text-emerald-400 text-xs mt-2 font-medium tracking-widest">{personaTitle} <span className="text-white/50">({tier})</span></p>
          <p className="text-[9px] text-white/20 mt-1 font-mono">{userId}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col mt-6 overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0 px-2">
          <div className="flex items-center gap-2"><span className="text-sm">🤝</span><span className="text-white/80 text-xs font-bold tracking-widest uppercase">인사이트 인맥</span></div>
          <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{safeFriendsList.length}명</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {safeFriendsList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50"><span className="text-3xl mb-3">📭</span><p className="text-[11px] text-white/70 leading-relaxed">아직 등록된 인맥이 없습니다.</p></div>
          ) : (
            safeFriendsList.map((friend, idx) => (
              <div key={idx} className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px]">👤</div>
                  <div className="flex flex-col text-left"><span className="text-sm font-bold text-white/90 group-hover:text-emerald-300">{friend.nickname}</span><span className="text-[9px] text-white/30 font-mono truncate w-32">{friend.userId}</span></div>
                </div>
                <button className="text-[10px] border border-white/10 bg-white/5 text-white/60 px-3 py-1.5 rounded-full hover:bg-white/20 hover:text-white transition-all">쪽지</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}