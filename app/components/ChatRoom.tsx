import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function ChatRoom({
  socketRef, room, userId, partnerId, myRole, partnerRole, selectedTopic, isSingleMode,
  messages, setMessages, isTyping, timeLeft, formatTime, 
  isAnalyzing, reportData, reportStats, setReportData, showAd, setShowAd, adCountdown, tier,
  hasVoted, setHasVoted, voteStatus, extensionCount, forceLeaveRoom, showModal
}: any) {
  const [inputText, setInputText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const [isPartnerCardUnlocked, setIsPartnerCardUnlocked] = useState(false);
  
  const reportCardRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleRewardEarned = () => {
      setIsPartnerCardUnlocked(true);
    };
    window.addEventListener('REWARD_EARNED', handleRewardEarned);
    return () => window.removeEventListener('REWARD_EARNED', handleRewardEarned);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !room) return;
    
    setMessages((prev: any) => [...prev, { sender: myRole || '나', text: inputText }]);
    socketRef.current?.emit('send_message', { room: room, roomId: room, text: inputText, partner: partnerRole });
    setInputText('');
  };

  const handleReportSubmit = () => {
    if (!reportReason) { showModal('경고', '신고 사유를 선택해 주세요.', 'alert'); return; }
    showModal('사용자 신고 및 차단', '상대방을 신고하고 영구 차단하시겠습니까?\n차단된 유저로부터는 쪽지(DM)를 받지 않습니다.', 'confirm', () => {
      socketRef.current?.emit('report_user', { room, reporterId: userId, reason: reportReason });
      socketRef.current?.emit('block_user', { room, userId }); 
      showModal('처리 완료', '신고 및 차단이 완료되었습니다.', 'alert');
      setIsReportModalOpen(false);
      setReportReason('');
      forceLeaveRoom();
    });
  };

  const handleShareCard = async () => {
    if (!reportCardRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(reportCardRef.current, { scale: 2, backgroundColor: '#0a0a0a', useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'weus_card.png', { type: 'image/png' })] })) {
          const file = new File([blob], 'weus_persona.png', { type: 'image/png' });
          await navigator.share({ title: 'WE US', text: '나의 소통 능력 페르소나!', files: [file] });
        } else {
          const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = 'weus_persona.png'; link.click();
          showModal('저장 완료', '인스타그램에 바로 공유해 보세요!', 'alert');
        }
      }, 'image/png');
    } catch (err) { showModal('오류', '이미지 캡처 중 오류가 발생했습니다.', 'alert'); } finally { setIsCapturing(false); }
  };

  const handleAddFriend = () => {
    if (!partnerId) return showModal('알림', 'AI와는 친구를 맺을 수 없습니다.', 'alert');
    socketRef.current?.emit('add_friend', { userId, friendId: partnerId });
    showModal('인맥 추가 완료', '상대방을 인사이트 인맥에 추가했습니다!\nPROFILE 창에서 확인하세요.', 'alert');
  };

  const handleWatchAdForPartnerCard = () => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage('SHOW_REWARDED_AD');
    } else {
      setIsPartnerCardUnlocked(true);
    }
  };

  return (
    <div className="w-full flex-1 mb-4 bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-white/10 relative">
      
      {/* ★ 변경점: 타임오버 화면에 "로비로 나가기" 버튼 명시적 추가 */}
      {timeLeft === 0 && !showAd && !reportData && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-md px-4">
          <span className="text-4xl sm:text-5xl font-black text-red-500 tracking-[0.2em] drop-shadow-[0_0_30px_rgba(239,68,68,1)] animate-pulse">
            TIME OVER
          </span>
          <p className="text-white/80 mt-4 font-bold tracking-widest text-xs sm:text-sm drop-shadow-md">
            {isAnalyzing ? 'AI가 대화를 분석 중입니다...' : '대화가 종료되었습니다.'}
          </p>
          
          {/* 분석 중이 아닐 때 (에러 시 로비 튕기기 예외 처리용 버튼) */}
          {!isAnalyzing && (
            <button 
              onClick={() => forceLeaveRoom()} 
              className="mt-8 w-full max-w-[200px] py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-bold tracking-widest text-sm transition-colors"
            >
              로비로 나가기
            </button>
          )}
        </div>
      )}

      {isReportModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[70] p-4 sm:p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl flex flex-col">
            <h3 className="text-base sm:text-lg font-bold text-red-400 mb-2 flex items-center gap-2 tracking-widest">🚨 신고 및 차단</h3>
            <p className="text-[10px] sm:text-xs text-white/50 mb-6 leading-relaxed">건전한 환경을 위해 사유를 선택해 주세요. 즉시 대화가 차단됩니다.</p>
            <div className="space-y-2 mb-6 sm:mb-8">
              {['욕설 및 비하', '음란성 발언', '광고 및 도배', '기타 사유'].map((reason) => (
                <button key={reason} onClick={() => setReportReason(reason)} className={`w-full text-left p-3 sm:p-4 rounded-xl text-xs font-semibold tracking-wider transition-all border ${reportReason === reason ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white/[0.02] border-transparent text-white/50 hover:bg-white/[0.05]'}`}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-3 bg-white/5 text-white/70 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest">취소</button>
              <button onClick={handleReportSubmit} className="flex-1 py-3 bg-red-900/50 text-red-200 border border-red-800/50 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest">차단</button>
            </div>
          </div>
        </div>
      )}

      {showAd && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[60] p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
            <div className="p-2 bg-gray-950 text-[9px] sm:text-[10px] text-gray-500 text-right">Sponsored</div>
            <div className="h-48 sm:h-56 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6 text-center relative">
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 z-10">분석을 완료하는 중...</h3>
              <p className="text-white/90 text-xs sm:text-sm z-10 font-medium">WE US 프리미엄 패스를 확인해보세요</p>
            </div>
            <div className="p-3 sm:p-4 flex justify-between items-center bg-gray-900 border-t border-gray-800">
              <span className="text-[10px] sm:text-xs text-gray-400 font-bold">{adCountdown > 0 ? `AI 분석 중...` : '리포트 준비 완료!'}</span>
              <button onClick={() => setShowAd(false)} disabled={adCountdown > 0} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${adCountdown > 0 ? 'bg-gray-800 text-gray-500' : 'bg-white text-black'}`}>{adCountdown > 0 ? `${adCountdown}초 후 건너뛰기` : '결과 보기 ▶'}</button>
            </div>
          </div>
        </div>
      )}

      {reportData && !showAd && (
        <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-xl">
          <div ref={reportCardRef} className="bg-[#0a0a0a] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-sm shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex justify-between items-center mb-4 sm:mb-6 border-b border-white/10 pb-3 sm:pb-4 shrink-0">
               <h2 className="text-[9px] sm:text-[10px] font-bold tracking-[0.3em] text-white/50">WE US REPORT</h2><span className="text-[9px] sm:text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-1 rounded-full">{tier}</span>
            </div>
            
            <div className="w-full flex justify-around mb-4 sm:mb-6 px-1 sm:px-2 shrink-0">
              <div className="flex flex-col items-center"><span className="text-[9px] sm:text-[10px] text-white/40 mb-1">LOGIC</span><span className="text-lg sm:text-xl font-bold text-blue-400">{reportStats?.logic || 50}</span></div>
              <div className="flex flex-col items-center"><span className="text-[9px] sm:text-[10px] text-white/40 mb-1">LINGUISTICS</span><span className="text-lg sm:text-xl font-bold text-emerald-400">{reportStats?.linguistics || 50}</span></div>
              <div className="flex flex-col items-center"><span className="text-[9px] sm:text-[10px] text-white/40 mb-1">EMPATHY</span><span className="text-lg sm:text-xl font-bold text-purple-400">{reportStats?.empathy || 50}</span></div>
            </div>

            <h2 className="text-sm sm:text-lg font-light tracking-widest text-center mb-3 sm:mb-4 text-white shrink-0">{isSingleMode ? 'PERSONAL TUTORING' : 'CHEMISTRY ANALYSIS'}</h2>
            
            <div className="overflow-y-auto text-[11px] sm:text-xs text-gray-300 whitespace-pre-line leading-relaxed flex-1 bg-white/[0.02] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 [&::-webkit-scrollbar]:hidden">
              {reportData}
            </div>

            {!isSingleMode && partnerId && (
              <div className="mt-4 border-t border-white/10 pt-4 shrink-0">
                {!isPartnerCardUnlocked ? (
                  <button
                    onClick={handleWatchAdForPartnerCard}
                    className="w-full bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 hover:from-purple-900/60 hover:to-pink-900/60 text-purple-300 font-bold py-3 rounded-xl flex justify-center items-center gap-2 text-xs sm:text-sm transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] animate-pulse"
                  >
                    🔒 상대방({partnerRole}) 스탯 훔쳐보기
                  </button>
                ) : (
                  <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-xl animate-fade-in">
                    <h3 className="text-[10px] sm:text-xs font-bold text-purple-300 mb-1 text-center">🔓 상대방({partnerRole})의 예상 스탯</h3>
                    <div className="flex justify-around mt-2">
                      <div className="flex flex-col items-center"><span className="text-[8px] text-white/40">LOGIC</span><span className="text-sm font-bold text-gray-300">{Math.min(100, Math.max(0, (reportStats?.logic || 50) + Math.floor(Math.random() * 20 - 10)))}</span></div>
                      <div className="flex flex-col items-center"><span className="text-[8px] text-white/40">LINGUISTICS</span><span className="text-sm font-bold text-gray-300">{Math.min(100, Math.max(0, (reportStats?.linguistics || 50) + Math.floor(Math.random() * 20 - 10)))}</span></div>
                      <div className="flex flex-col items-center"><span className="text-[8px] text-white/40">EMPATHY</span><span className="text-sm font-bold text-gray-300">{Math.min(100, Math.max(0, (reportStats?.empathy || 50) + Math.floor(Math.random() * 20 - 10)))}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 sm:mt-4 text-center text-[8px] sm:text-[10px] text-white/30 font-mono shrink-0">we-us.online</div>
          </div>
          
          <div className="w-full max-w-sm mt-3 sm:mt-4 space-y-2 px-1 sm:px-2 shrink-0">
            {!isSingleMode && partnerId && (
              <button onClick={handleAddFriend} className="w-full bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 font-bold py-3 sm:py-3.5 rounded-xl transition-colors flex justify-center items-center text-xs sm:text-sm tracking-widest">
                🤝 인사이트 인맥(친구) 추가하기
              </button>
            )}
            <div className="flex gap-2 w-full">
              <button onClick={handleShareCard} disabled={isCapturing} className="flex-1 bg-white text-black font-bold py-3 sm:py-3.5 rounded-xl hover:bg-gray-200 flex justify-center items-center text-xs sm:text-sm transition-colors">{isCapturing ? '처리중...' : '📸 캡처'}</button>
              <button onClick={() => { setReportData(null); forceLeaveRoom(); }} className="px-5 sm:px-6 bg-transparent hover:bg-white/5 text-white/70 font-semibold py-3 sm:py-3.5 rounded-xl border border-white/10 text-xs sm:text-sm transition-colors">로비</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/[0.02] p-3 sm:p-4 flex justify-between items-center border-b border-white/5 shrink-0">
        <div className="flex flex-col gap-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-[11px] sm:text-xs text-white/90 truncate">{isSingleMode ? `AI 싱글: ${selectedTopic}` : `${selectedTopic}`}</span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {!isSingleMode && <button onClick={() => setIsReportModalOpen(true)} className="bg-red-500/10 text-red-400 text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold border border-red-500/30 shrink-0">🚨 차단</button>}
              <button onClick={() => showModal('대화방 퇴장', '정말 대화방에서 나가시겠습니까?', 'confirm', () => forceLeaveRoom())} className="bg-white/5 text-white/50 text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">나가기</button>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-400 font-bold truncate">내 역할: [{myRole}]</span>
        </div>
        <div className={`px-2 py-1 rounded-full border shrink-0 ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/80'}`}>
          <span className="font-mono text-[10px] sm:text-xs font-medium">{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((msg: any, idx: number) => (
          <div key={idx} className={`flex ${msg.sender === myRole || msg.sender === '나' ? 'justify-end' : msg.sender === 'System' ? 'justify-center' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 sm:p-3.5 rounded-2xl text-[12px] sm:text-[13px] leading-relaxed break-words ${msg.sender === myRole || msg.sender === '나' ? 'bg-white text-black rounded-tr-sm' : msg.sender === 'System' ? 'bg-emerald-900/20 text-emerald-100 border border-emerald-500/30 w-full mx-auto text-center font-medium shadow-lg text-[10px] sm:text-[11px]' : 'bg-white/10 text-white rounded-tl-sm'}`}>
              {msg.sender !== 'System' && <span className={`text-[9px] sm:text-[10px] block mb-1 font-bold ${msg.sender === myRole || msg.sender === '나' ? 'text-gray-500' : 'text-white/40'}`}>{msg.sender}</span>}
              <span className="whitespace-pre-line">{msg.text}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="max-w-[80%] p-2 sm:p-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 rounded-tl-sm flex items-center gap-1">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {timeLeft <= 60 && !isSingleMode && !isAnalyzing && !reportData && extensionCount < 2 && !showAd && (
        <div className="absolute bottom-[60px] sm:bottom-[70px] left-0 w-full p-2 bg-gradient-to-t from-[#0a0a0a] to-transparent flex flex-col items-center justify-center">
          <button onClick={() => { setHasVoted(true); socketRef.current?.emit('vote_extend', { room }); }} disabled={hasVoted} className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-bold text-[10px] sm:text-xs shadow-lg transition-all border ${hasVoted ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300'}`}>
            {hasVoted ? `동의 대기중 ${voteStatus}` : `+ 2분 연장하기 (${extensionCount}/2)`}
          </button>
        </div>
      )}

      {/* ★ 0.5초 도배 제한 속성 제거 (isCooldown 삭제됨) */}
      <form onSubmit={sendMessage} className="p-2 sm:p-3 bg-[#050505] border-t border-white/5 flex gap-2 z-10 relative shrink-0">
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={isAnalyzing || !!reportData || showAd} placeholder="메시지 입력..." className="flex-1 bg-white/5 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-full outline-none text-xs sm:text-sm"/>
        <button type="submit" disabled={isAnalyzing || !!reportData || showAd || !inputText.trim()} className="bg-white text-black w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold disabled:opacity-50 text-sm">↑</button>
      </form>
    </div>
  );
}