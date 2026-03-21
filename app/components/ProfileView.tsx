'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function ProfileView({ userId, tier, personaTitle, socketRef }: any) {
  const [nickname, setNickname] = useState('익명의 소통러'); // ★ 로딩중... 제거, 기본값 부여
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  
  const [activeChatFriend, setActiveChatFriend] = useState<{ userId: string, nickname: string } | null>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmInput, setDmInput] = useState('');
  const dmEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('get_profile', userId);
      
      // ★ 닉네임 동기화 로직 강화: 서버에서 주는 닉네임이 빈 값이 아닐 때만 덮어씀
      socketRef.current.on('receive_profile', (data: any) => {
        if (data.nickname) setNickname(data.nickname);
        setFriendsList(Array.isArray(data.friends) ? data.friends : []);
      });

      socketRef.current.on('receive_dms', (dms: any[]) => { setDmMessages(dms); });
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

  useEffect(() => { dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dmMessages]);

  const handleSaveNickname = () => {
    if (editInput.trim() === '') return alert("닉네임을 한 글자 이상 입력해주세요.");
    // ★ 즉시 화면 반영 (서버 응답 기다리지 않고 선반영하여 체감 속도 향상)
    setNickname(editInput); 
    socketRef.current?.emit('update_nickname', { userId, nickname: editInput });
    setIsEditing(false);
  };

  const openDmRoom = (friend: any) => { setActiveChatFriend(friend); socketRef.current?.emit('get_dms', { userId, friendId: friend.userId }); };

  const sendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInput.trim() || !activeChatFriend) return;
    socketRef.current?.emit('send_dm', { senderId: userId, receiverId: activeChatFriend.userId, text: dmInput });
    setDmInput('');
  };

  const safeFriendsList = Array.isArray(friendsList) ? friendsList : [];

  return (
    // ★ 소형폰 UI 깨짐 방지: 고정 높이 제거, flex-1과 overflow-y-auto 적용
    <div className="w-full flex-1 flex flex-col bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl relative mb-2 overflow-hidden">
      
      {activeChatFriend ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#050505]">
          <div className="p-3 sm:p-4 border-b border-white/10 flex items-center gap-3 shrink-0 bg-white/[0.02]">
            <button onClick={() => setActiveChatFriend(null)} className="text-white/50 hover:text-white px-2 py-1 text-lg">←</button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-sm">👤</div>
            <div className="flex flex-col"><span className="text-xs sm:text-sm font-bold text-white">{activeChatFriend.nickname}</span><span className="text-[9px] text-white/30 font-mono">1:1 다이렉트 메시지</span></div>
          </div>

          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {dmMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30"><span className="text-2xl mb-2">💬</span><span className="text-[10px] sm:text-xs">첫 메시지를 보내보세요.</span></div>
            ) : (
              dmMessages.map((msg, idx) => {
                const isMe = msg.senderId === userId;
                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-xl text-[12px] sm:text-[13px] leading-relaxed break-words ${isMe ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>{msg.text}</div>
                  </div>
                );
              })
            )}
            <div ref={dmEndRef} />
          </div>

          <form onSubmit={sendDm} className="p-2 sm:p-3 border-t border-white/10 bg-black flex gap-2 shrink-0">
            <input type="text" value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="쪽지 보내기..." className="flex-1 bg-white/5 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl outline-none text-xs sm:text-sm focus:bg-white/10 transition-colors" />
            <button type="submit" disabled={!dmInput.trim()} className="bg-white text-black px-4 sm:px-5 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-50">전송</button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col h-full p-4 sm:p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex flex-col items-center justify-center space-y-3 pb-4 sm:pb-6 border-b border-white/10 shrink-0 mt-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-white/20 flex items-center justify-center text-2xl sm:text-3xl shadow-[0_0_30px_rgba(16,185,129,0.15)]">🎭</div>
            <div className="text-center w-full px-2">
              {isEditing ? (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <input type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)} maxLength={10} placeholder="닉네임 입력" className="bg-black border border-emerald-500/50 text-white text-center rounded-lg px-2 sm:px-3 py-1.5 w-24 sm:w-32 outline-none focus:border-emerald-400 text-xs sm:text-sm" autoFocus />
                  <button onClick={handleSaveNickname} className="bg-emerald-500 text-black px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-emerald-400">저장</button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mt-2">
                  {/* ★ 닉네임이 길어도 화면을 뚫지 않게 truncate 및 사이즈 조절 */}
                  <h2 className="text-xl sm:text-2xl font-black tracking-wider text-white truncate max-w-[150px] sm:max-w-[200px]">{nickname}</h2>
                  <button onClick={() => { setEditInput(nickname === '익명의 소통러' ? '' : nickname); setIsEditing(true); }} className="text-white/40 hover:text-white/80 text-sm">✏️</button>
                </div>
              )}
              <p className="text-emerald-400 text-[10px] sm:text-xs mt-2 font-medium tracking-widest">{personaTitle} <span className="text-white/50">({tier})</span></p>
              <p className="text-[8px] sm:text-[9px] text-white/20 mt-1 font-mono">{userId}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col mt-4 sm:mt-6 overflow-hidden">
            <div className="flex justify-between items-center mb-3 shrink-0 px-1 sm:px-2">
              <div className="flex items-center gap-2"><span className="text-xs sm:text-sm">🤝</span><span className="text-white/80 text-[10px] sm:text-xs font-bold tracking-widest uppercase">인사이트 인맥</span></div>
              <span className="text-[9px] sm:text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{safeFriendsList.length}명</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 sm:pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {safeFriendsList.length === 0 ? (
                <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-center opacity-50"><span className="text-2xl sm:text-3xl mb-2 sm:mb-3">📭</span><p className="text-[9px] sm:text-[11px] text-white/70 leading-relaxed">아직 등록된 인맥이 없습니다.</p></div>
              ) : (
                safeFriendsList.map((friend, idx) => (
                  <div key={idx} onClick={() => openDmRoom(friend)} className="bg-black/40 border border-white/5 rounded-xl p-3 sm:p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center text-[8px] sm:text-[10px] shrink-0">👤</div>
                      <div className="flex flex-col text-left overflow-hidden">
                        <span className="text-xs sm:text-sm font-bold text-white/90 group-hover:text-emerald-300 truncate">{friend.nickname}</span>
                        <span className="text-[8px] sm:text-[9px] text-white/30 font-mono truncate w-20 sm:w-32">{friend.userId}</span>
                      </div>
                    </div>
                    <button className="text-[8px] sm:text-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full group-hover:bg-emerald-500/30 transition-all shrink-0">쪽지 보내기</button>
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