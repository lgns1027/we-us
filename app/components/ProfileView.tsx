'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function ProfileView({ userId, tier, personaTitle, socketRef }: any) {
  const [nickname, setNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  
  // ★ 1:1 쪽지(DM) 관련 상태
  const [activeChatFriend, setActiveChatFriend] = useState<{ userId: string, nickname: string } | null>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmInput, setDmInput] = useState('');
  const dmEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('get_profile', userId);
      socketRef.current.on('receive_profile', (data: any) => {
        setNickname(data.nickname);
        setFriendsList(Array.isArray(data.friends) ? data.friends : []);
      });

      // 서버에서 보낸 과거 DM 내역 수신
      socketRef.current.on('receive_dms', (dms: any[]) => {
        setDmMessages(dms);
      });

      // 누군가 보낸 실시간 새 DM 수신
      socketRef.current.on('new_dm_arrived', (newMsg: any) => {
        if (
          (newMsg.senderId === userId && newMsg.receiverId === activeChatFriend?.userId) ||
          (newMsg.senderId === activeChatFriend?.userId && newMsg.receiverId === userId)
        ) {
          setDmMessages(prev => [...prev, newMsg]);
        }
      });
    }
    return () => { 
      socketRef.current?.off('receive_profile'); 
      socketRef.current?.off('receive_dms');
      socketRef.current?.off('new_dm_arrived');
    };
  }, [userId, socketRef, activeChatFriend]);

  // DM 스크롤 맨 아래로 유지
  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages]);

  const handleSaveNickname = () => {
    if (editInput.trim() === '') return alert("닉네임을 입력해주세요.");
    socketRef.current?.emit('update_nickname', { userId, nickname: editInput });
    setIsEditing(false);
  };

  const openDmRoom = (friend: any) => {
    setActiveChatFriend(friend);
    socketRef.current?.emit('get_dms', { userId, friendId: friend.userId });
  };

  const sendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInput.trim() || !activeChatFriend) return;
    socketRef.current?.emit('send_dm', { senderId: userId, receiverId: activeChatFriend.userId, text: dmInput });
    setDmInput('');
  };

  const safeFriendsList = Array.isArray(friendsList) ? friendsList : [];

  return (
    <div className="w-full flex flex-col h-full bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl relative mb-6 overflow-hidden">
      
      {/* ========================================== */}
      {/* 1. 쪽지방(DM) 화면 (활성화 되었을 때만 렌더링) */}
      {/* ========================================== */}
      {activeChatFriend ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#050505]">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 shrink-0 bg-white/[0.02]">
            <button onClick={() => setActiveChatFriend(null)} className="text-white/50 hover:text-white px-2 py-1">←</button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-sm">👤</div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">{activeChatFriend.nickname}</span>
              <span className="text-[10px] text-white/30 font-mono">1:1 다이렉트 메시지</span>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {dmMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                <span className="text-2xl mb-2">💬</span>
                <span className="text-xs">첫 메시지를 보내보세요.</span>
              </div>
            ) : (
              dmMessages.map((msg, idx) => {
                const isMe = msg.senderId === userId;
                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3.5 rounded-2xl text-[13px] leading-relaxed ${isMe ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={dmEndRef} />
          </div>

          <form onSubmit={sendDm} className="p-3 border-t border-white/10 bg-black flex gap-2 shrink-0">
            <input type="text" value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="쪽지 보내기..." className="flex-1 bg-white/5 text-white px-4 py-3 rounded-xl outline-none text-sm focus:bg-white/10 transition-colors" />
            <button type="submit" disabled={!dmInput.trim()} className="bg-white text-black px-5 rounded-xl font-bold text-sm disabled:opacity-50">전송</button>
          </form>
        </div>
      ) : (
        /* ========================================== */
        /* 2. 기본 프로필 화면 (친구 목록) */
        /* ========================================== */
        <div className="flex flex-col h-full p-6">
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
                  <div key={idx} onClick={() => openDmRoom(friend)} className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px]">👤</div>
                      <div className="flex flex-col text-left"><span className="text-sm font-bold text-white/90 group-hover:text-emerald-300">{friend.nickname}</span><span className="text-[9px] text-white/30 font-mono truncate w-32">{friend.userId}</span></div>
                    </div>
                    <button className="text-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 rounded-full group-hover:bg-emerald-500/30 transition-all">쪽지 보내기</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}