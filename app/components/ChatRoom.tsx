import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function ChatRoom({
  socketRef, room, userId, partnerId, myRole, partnerRole, selectedTopic, isSingleMode,
  messages, setMessages, isTyping, timeLeft, formatTime, 
  isAnalyzing, reportData, setReportData, showAd, setShowAd, adCountdown, tier,
  hasVoted, setHasVoted, voteStatus, extensionCount, forceLeaveRoom, showModal
}: any) {
  const [inputText, setInputText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const reportCardRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    showModal('사용자 신고', '상대방을 신고하고 대화방을 즉시 나가시겠습니까?', 'confirm', () => {
      socketRef.current?.emit('report_user', { room, reporterId: userId, reason: reportReason });
      showModal('신고 완료', '신고가 접수되었습니다. 철저히 검토하여 조치하겠습니다.', 'alert');
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

  // ★ 친구 추가 로직
  const handleAddFriend = () => {
    if (!partnerId) return showModal('알림', 'AI와는 친구를 맺을 수 없습니다.', 'alert');
    socketRef.current?.emit('add_friend', { userId, friendId: partnerId });
    showModal('인맥 추가 완료', '상대방을 인사이트 인맥에 추가했습니다!\nPROFILE 창에서 확인하세요.', 'alert');
  };

  return (
    <div className="w-full flex-1 mb-4 bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-white/10 relative">
      
      {/* TIME OVER 이펙트 */}
      {timeLeft === 0 && isAnalyzing && !showAd && !reportData && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/30 backdrop-blur-sm animate-pulse">
          <span className="text-5xl font-black text-red-500 tracking-[0.2em] drop-shadow-[0_0_30px_rgba(239,68,68,1)] scale-110 transition-transform">
            TIME OVER
          </span>
          <p className="text-white/80 mt-4 font-bold tracking-widest text-sm drop-shadow-md">대화가 종료되었습니다</p>
        </div>
      )}

      {/* 신고 모달 */}
      {isReportModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[70] p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col">
            <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2 tracking-widest">🚨 사용자 신고</h3>
            <p className="text-xs text-white/50 mb-6 leading-relaxed">건전한 환경을 위해 사유를 선택해 주세요. 즉시 대화가 차단됩니다.</p>
            <div className="space-y-2 mb-8">
              {['욕설 및 비하', '음란성 발언', '광고 및 도배', '기타 사유'].map((reason) => (
                <button key={reason} onClick={() => setReportReason(reason)} className={`w-full text-left p-4 rounded-xl text-xs font-semibold tracking-wider transition-all border ${reportReason === reason ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white/[0.02] border-transparent text-white/50 hover:bg-white/[0.05]'}`}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-3.5 bg-white/5 text-white/70 rounded-xl text-xs font-bold tracking-widest">취소</button>
              <button onClick={handleReportSubmit} className="flex-1 py-3.5 bg-red-900/50 text-red-200 border border-red-800/50 rounded-xl text-xs font-bold tracking-widest">신고 및 나가기</button>
            </div>
          </div>
        </div>
      )}

      {showAd && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[60] p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex flex-col">
            <div className="p-2 bg-gray-950 text-[10px] text-gray-500 text-right">Sponsored</div>
            <div className="h-56 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6 text-center relative">
              <h3 className="text-2xl font-black text-white mb-2 z-10">분석을 완료하는 중...</h3>
              <p className="text-white/90 text-sm z-10 font-medium">WE US 프리미엄 패스를 확인해보세요</p>
            </div>
            <div className="p-4 flex justify-between items-center bg-gray-900 border-t border-gray-800">
              <span className="text-xs text-gray-400 font-bold">{adCountdown > 0 ? `AI 분석 중...` : '리포트 준비 완료!'}</span>
              <button onClick={() => setShowAd(false)} disabled={adCountdown > 0} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${adCountdown > 0 ? 'bg-gray-800 text-gray-500' : 'bg-white text-black'}`}>{adCountdown > 0 ? `${adCountdown}초 후 건너뛰기` : '결과 보기 ▶'}</button>
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && !showAd && !reportData && timeLeft > 0 && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-40 backdrop-blur-md">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mb-6"></div><p className="text-white font-light tracking-widest">분석 중입니다...</p>
        </div>
      )}

      {/* 리포트 결과 및 친구 추가 버튼 영역 */}
      {reportData && !showAd && (
        <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center z-50 p-4 backdrop-blur-xl">
          <div ref={reportCardRef} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
               <h2 className="text-[10px] font-bold tracking-[0.3em] text-white/50">WE US REPORT</h2><span className="text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-1 rounded-full">{tier}</span>
            </div>
            <h2 className="text-lg font-light tracking-widest text-center mb-6 text-white">{isSingleMode ? 'PERSONAL TUTORING' : 'CHEMISTRY ANALYSIS'}</h2>
            <div className="space-y-4 text-xs text-gray-300 whitespace-pre-line leading-relaxed flex-1 bg-white/[0.02] p-5 rounded-2xl border border-white/5">{reportData}</div>
            <div className="mt-4 text-center text-[10px] text-white/30 font-mono">we-us.online</div>
          </div>
          
          <div className="w-full max-w-sm mt-4 space-y-2 px-2">
            {/* ★ 친구 추가 버튼 추가 */}
            {!isSingleMode && partnerId && (
              <button onClick={handleAddFriend} className="w-full bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center text-sm tracking-widest">
                🤝 인사이트 인맥(친구) 추가하기
              </button>
            )}
            <div className="flex gap-2 w-full">
              <button onClick={handleShareCard} disabled={isCapturing} className="flex-1 bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-200 flex justify-center items-center text-sm transition-colors">{isCapturing ? '처리중...' : '📸 캡처'}</button>
              <button onClick={() => { setReportData(null); forceLeaveRoom(); }} className="px-6 bg-transparent hover:bg-white/5 text-white/70 font-semibold py-3.5 rounded-xl border border-white/10 text-sm transition-colors">로비</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white/[0.02] p-4 flex justify-between items-center border-b border-white/5 shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-xs text-white/90 truncate">{isSingleMode ? `AI 싱글: ${selectedTopic}` : `${selectedTopic}`}</span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {!isSingleMode && <button onClick={() => showModal('🚨 사용자 신고', '사유를 선택해 주세요. 즉시 대화가 차단됩니다.', 'confirm', () => forceLeaveRoom())} className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">🚨 신고</button>}
              <button onClick={() => showModal('대화방 퇴장', '정말 대화방에서 나가시겠습니까?', 'confirm', () => forceLeaveRoom())} className="bg-white/5 text-white/50 text-[10px] px-2 py-0.5 rounded-full">나가기</button>
            </div>
          </div>
          <span className="text-[11px] text-emerald-400 font-bold truncate">내 역할: [{myRole}]</span>
        </div>
        <div className={`px-2.5 py-1 rounded-full border shrink-0 ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/80'}`}>
          <span className="font-mono text-xs font-medium">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* 채팅 내역 */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((msg: any, idx: number) => (
          <div key={idx} className={`flex ${msg.sender === myRole || msg.sender === '나' ? 'justify-end' : msg.sender === 'System' ? 'justify-center' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed ${msg.sender === myRole || msg.sender === '나' ? 'bg-white text-black rounded-tr-sm' : msg.sender === 'System' ? 'bg-emerald-900/20 text-emerald-100 border border-emerald-500/30 w-full mx-auto text-center font-medium shadow-lg' : 'bg-white/10 text-white rounded-tl-sm'}`}>
              {msg.sender !== 'System' && <span className={`text-[10px] block mb-1 font-bold ${msg.sender === myRole || msg.sender === '나' ? 'text-gray-500' : 'text-white/40'}`}>{msg.sender}</span>}
              <span className="whitespace-pre-line">{msg.text}</span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="max-w-[80%] p-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 rounded-tl-sm flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        
        {/* 자동 스크롤 기준점 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 연장 투표 버튼 */}
      {timeLeft <= 60 && !isSingleMode && !isAnalyzing && !reportData && extensionCount < 2 && !showAd && (
        <div className="absolute bottom-[70px] left-0 w-full p-2 bg-gradient-to-t from-[#0a0a0a] to-transparent flex flex-col items-center justify-center">
          <button onClick={() => { setHasVoted(true); socketRef.current?.emit('vote_extend', { room }); }} disabled={hasVoted} className={`px-5 py-2 rounded-full font-bold text-xs shadow-lg transition-all border ${hasVoted ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300'}`}>
            {hasVoted ? `동의 대기중 ${voteStatus}` : `+ 2분 연장하기 (${extensionCount}/2)`}
          </button>
        </div>
      )}

      {/* 입력 폼 */}
      <form onSubmit={sendMessage} className="p-3 bg-[#050505] border-t border-white/5 flex gap-2 z-10 relative shrink-0">
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={isAnalyzing || !!reportData || showAd} placeholder="메시지 입력..." className="flex-1 bg-white/5 text-white px-4 py-3 rounded-full outline-none text-sm"/>
        <button type="submit" disabled={isAnalyzing || !!reportData || showAd || !inputText.trim()} className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center font-bold disabled:opacity-50">↑</button>
      </form>
    </div>
  );
}