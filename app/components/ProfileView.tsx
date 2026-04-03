'use client';

import React, { useState, useEffect, useRef } from 'react';

const PERSONA_ICONS = ['🧠', '⚖️', '✨', '🕊️', '👑', '🌱'];

export default function ProfileView({ userId, tier, personaTitle, socketRef }: any) {
  const [nickname, setNickname] = useState('익명의 소통러');
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);

  const [activeChatFriend, setActiveChatFriend] = useState<{ userId: string, nickname: string } | null>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmInput, setDmInput] = useState('');
  const dmEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cachedNickname = localStorage.getItem('weus_nickname');
    if (cachedNickname) setNickname(cachedNickname);
  }, []);

  useEffect(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('get_profile', userId);

      socketRef.current.on('receive_profile', (data: any) => {
        if (data.nickname) {
          setNickname(data.nickname);
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
    if (editInput.trim() === '') return alert('닉네임을 한 글자 이상 입력해주세요.');
    setNickname(editInput);
    localStorage.setItem('weus_nickname', editInput);
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
  const hasPersona = personaTitle && personaTitle !== '데이터 수집 중';

  // DM view
  if (activeChatFriend) {
    return (
      <div className="w-full flex flex-col h-full bg-[#050505]">
        <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-3 shrink-0 bg-[#0a0a0a]">
          <button onClick={() => setActiveChatFriend(null)} className="text-[#555] hover:text-[#f0f0f0] text-xl font-light px-1">←</button>
          <div className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-base">👤</div>
          <div>
            <p className="text-sm font-bold text-[#f0f0f0]">{activeChatFriend.nickname}</p>
            <p className="text-[10px] text-[#4ade80]">WE US 인맥</p>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {dmMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <span className="text-3xl mb-2">👋</span>
              <span className="text-xs text-[#888]">{activeChatFriend.nickname}님과 첫 대화를 시작해 보세요.</span>
            </div>
          ) : (
            dmMessages.map((msg, idx) => {
              const isMe = msg.senderId === userId;
              return (
                <div key={idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-3 text-[13px] leading-relaxed break-words ${
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

        <form onSubmit={sendDm} className="p-3 border-t border-[#1a1a1a] bg-[#0a0a0a] flex gap-2 shrink-0 items-center">
          <input
            type="text" value={dmInput} onChange={(e) => setDmInput(e.target.value)}
            placeholder="메시지 입력..."
            className="flex-1 bg-[#1a1a1a] text-[#f0f0f0] px-4 py-3 rounded-full outline-none text-[13px] border border-[#333] focus:border-[#4ade80]/50 transition-colors"
          />
          <button type="submit" disabled={!dmInput.trim()}
            className="bg-[#3b82f6] text-white w-10 h-10 rounded-full flex items-center justify-center font-black disabled:opacity-40 disabled:bg-[#1a1a1a] shrink-0">
            →
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col pb-4">
      {/* Profile header */}
      <div className="text-center pb-4 border-b border-[#1a1a1a] mb-4">
        <div className="relative w-[72px] h-[72px] mx-auto mb-3">
          <div className="w-[72px] h-[72px] rounded-full bg-[#1a1a1a] border-2 border-[#333] flex items-center justify-center text-[30px]">
            🎭
          </div>
          <div className="absolute bottom-[-2px] right-[-2px] bg-[#161616] border border-[#333] rounded-lg px-1.5 py-0.5 text-[9px] text-[#555]">
            ?
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center justify-center gap-2 mb-1">
            <input
              type="text" value={editInput} onChange={(e) => setEditInput(e.target.value)}
              maxLength={10} placeholder="닉네임 입력" autoFocus
              className="bg-[#0c0c0c] border border-[#4ade80]/50 text-white text-center rounded-lg px-3 py-1.5 w-32 outline-none text-sm focus:border-[#4ade80]"
            />
            <button onClick={handleSaveNickname} className="bg-[#4ade80] text-black px-3 py-1.5 rounded-lg text-xs font-bold">저장</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-lg font-black text-[#f0f0f0]">{nickname}</h2>
            <button onClick={() => { setEditInput(nickname === '익명의 소통러' ? '' : nickname); setIsEditing(true); }} className="text-[#555] hover:text-[#f0f0f0] text-sm transition-colors">✏️</button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-semibold text-[#4ade80]">{tier}</span>
          <span className="text-[10px] text-[#333]">·</span>
          <span className="text-[10px] text-[#555]">{hasPersona ? personaTitle : '데이터 수집 중'}</span>
        </div>
        <p className="text-[9px] text-[#333] font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px] mx-auto">{userId}</p>
      </div>

      {/* Friends section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🤝</span>
            <span className="text-xs font-semibold text-[#ddd]">인사이트 인맥</span>
          </div>
          <span className="text-[10px] text-[#555] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-0.5">{safeFriendsList.length}명</span>
        </div>

        {safeFriendsList.length === 0 ? (
          <div className="bg-[#161616] border border-dashed border-[#2a2a2a] rounded-xl p-4 text-center">
            <p className="text-lg mb-1.5">👥</p>
            <p className="text-[11px] text-[#555] leading-relaxed">대화 후 상대방을 친구로 추가하면<br />여기에 표시돼요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {safeFriendsList.map((friend, idx) => (
              <div key={idx} onClick={() => openDmRoom(friend)}
                className="bg-[#161616] border border-[#222] rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-[#333] transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-sm shrink-0">👤</div>
                  <div className="overflow-hidden">
                    <p className="text-[13px] font-bold text-[#f0f0f0] truncate">{friend.nickname}</p>
                    <p className="text-[9px] text-[#444] font-mono truncate">{friend.userId}</p>
                  </div>
                </div>
                <span className="text-[#444] text-sm shrink-0">→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Persona section */}
      <div>
        <p className="text-[11px] font-semibold text-[#555] mb-2">나의 소통 퍼르소나</p>
        {hasPersona ? (
          <div className="bg-[#161616] border border-[#222] rounded-xl p-3 text-center">
            <p className="text-2xl mb-1">{personaTitle.split(' ')[0]}</p>
            <p className="text-sm font-bold text-[#f0f0f0]">{personaTitle.split(' ').slice(1).join(' ')}</p>
          </div>
        ) : (
          <div className="bg-[#0f0f0f] border border-[#222] rounded-[14px] p-4 flex flex-col items-center text-center gap-2">
            <div className="flex gap-1.5 mb-0.5">
              {PERSONA_ICONS.map((icon, i) => (
                <span key={i} className="text-base opacity-20">{icon}</span>
              ))}
            </div>
            <p className="text-[11px] text-[#555] leading-relaxed">첫 대화 완료 후<br />6가지 퍼르소나 중 하나가 해금돼요</p>
            <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-1.5 mt-0.5">
              <span className="text-[10px] font-semibold text-[#888]">🔒 해금 조건: 대화 1회 완료</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
