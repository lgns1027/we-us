'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function ProfileView({ userId, tier, personaTitle, socketRef }: any) {
  const [nickname, setNickname] = useState('익명의 소통러'); 
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  
  const [activeChatFriend, setActiveChatFriend] = useState<{ userId: string, nickname: string } | null>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmInput, setDmInput] = useState('');
  const dmEndRef = useRef<HTMLDivElement>(null);

  // ★ 신규: 컴포넌트 마운트 시 무조건 로컬 캐시부터 뒤져서 화면에 즉시 띄움 (깜빡임 방지)
  useEffect(() => {
    const cachedNickname = localStorage.getItem('weus_nickname');
    if (cachedNickname) {
      setNickname(cachedNickname);
    }
  }, []);

  useEffect(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('get_profile', userId);
      
      socketRef.current.on('receive_profile', (data: any) => {
        if (data.nickname) {
          setNickname(data.nickname);
          // ★ 서버에서 받은 닉네임도 안전하게 로컬에 백업
          localStorage.setItem('weus_nickname', data.nickname);
        }
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
    
    // ★ 서버로 쏘기 전에 화면부터 바로 변경하고 기기에 각인 (Optimistic UI)
    setNickname(editInput); 
    localStorage.setItem('weus_nickname', editInput);
    
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
    <div className="w-full flex-1 flex flex-col bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl relative mb-2 overflow-hidden">
      
      {activeChatFriend ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#050505]">
          {/* DM 헤더 영역 */}
          <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChatFriend(null)} className="text-white/60 hover:text-white px-2 py-1 text-xl font-light">←</button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 flex items-center justify-center text-lg border border-white/10">👤</div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">{activeChatFriend.nickname}</span>
                <span className="text-[10px] text-emerald-400 font-medium">WE US 인맥</span>
              </div>
            </div>
          </div>

          {/* DM 채팅 내역 */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {dmMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <span className="text-3xl mb-3">👋</span>
                <span className="text-xs tracking-widest text-white/80">{activeChatFriend.nickname}님과 첫 대화를 시작해 보세요.</span>
              </div>
            ) : (
              dmMessages.map((msg, idx) => {
                const isMe = msg.senderId === userId;
                return (
                  <div key={idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-3 text-[13px] leading-relaxed break-words shadow-sm ${
                      isMe 
                        ? 'bg-[#3b82f6] text-white rounded-2xl rounded-tr-sm' 
                        : 'bg-[#1f2937] text-white/90 border border-white/5 rounded-2xl rounded-tl-sm' 
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={dmEndRef} />
          </div>

          {/* DM 입력 폼 */}
          <form onSubmit={sendDm} className="p-3 border-t border-white/5 bg-[#0a0a0a] flex gap-2 shrink-0 items-center">
            <input type="text" value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="메시지 입력..." className="flex-1 bg-white/5 text-white px-5 py-3.5 rounded-full outline-none text-[13px] focus:bg-white/10 transition-colors" />
            <button type="submit" disabled={!dmInput.trim()} className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-black disabled:opacity-50 disabled:bg-white/10">→</button>
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
                  <h2 className="text-xl sm:text-2xl font-black tracking-wider text-white truncate max-w-[150px] sm:max-w-[200px]">{nickname}</h2>
                  <button onClick={() => { setEditInput(nickname === '익명의 소통러' ? '' : nickname); setIsEditing(true); }} className="text-white/40 hover:text-white/80 text-sm">✏️</button>
                </div>
              )}
              <p className="text-emerald-400 text-[10px] sm:text-xs mt-2 font-medium tracking-widest">{personaTitle} <span className="text-white/50">({tier})</span></p>
              <p className="text-[8px] sm:text-[9px] text-white/20 mt-1 font-mono">{userId}</p>
            </div>
          </div>

          {/* 친구(인맥) 리스트 영역 */}
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
                  <div key={idx} onClick={() => openDmRoom(friend)} className="bg-black/40 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group shadow-sm">
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-lg sm:text-xl shrink-0">👤</div>
                      <div className="flex flex-col text-left overflow-hidden">
                        <span className="text-[13px] sm:text-[15px] font-bold text-white/90 group-hover:text-emerald-300 truncate">{friend.nickname}</span>
                        <span className="text-[9px] sm:text-[10px] text-white/30 font-mono truncate w-24 sm:w-36 mt-0.5">{friend.userId}</span>
                      </div>
                    </div>
                    <div className="text-white/30 group-hover:text-emerald-400 transition-colors text-lg">→</div>
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