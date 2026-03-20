import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

export default function ChatRoom({
  socketRef, room, userId, myRole, partnerRole, selectedTopic, isSingleMode,
  messages, setMessages, isTyping, timeLeft, formatTime, 
  isAnalyzing, reportData, setReportData, showAd, setShowAd, adCountdown, tier,
  hasVoted, setHasVoted, voteStatus, extensionCount, forceLeaveRoom
}: any) {
  const [inputText, setInputText] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const reportCardRef = useRef<HTMLDivElement>(null);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !room) return;
    setMessages((prev: any) => [...prev, { sender: myRole || '나', text: inputText }]);
    socketRef.current?.emit('send_message', { room: room, roomId: room, text: inputText, partner: partnerRole });
    setInputText('');
  };

  const handleLeaveRoom = () => {
    if (confirm("정말 대화방에서 나가시겠습니까?")) forceLeaveRoom();
  };

  const handleReportSubmit = () => {
    if (!reportReason) { alert("신고 사유를 선택해 주세요."); return; }
    if (confirm("상대방을 신고하고 대화방을 즉시 나가시겠습니까?")) {
      socketRef.current?.emit('report_user', { room, reporterId: userId, reason: reportReason });
      alert("신고가 접수되었습니다. 철저히 검토하여 조치하겠습니다.");
      setIsReportModalOpen(false);
      setReportReason('');
      forceLeaveRoom();
    }
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
          await navigator.share({ title: 'WE US', text: '나의 소통 능력 페르소나! 👉 we-us.online', files: [file] });
        } else {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = 'weus_persona.png';
          link.click();
          alert('저장되었습니다. 인스타그램에 바로 공유해 보세요!');
        }
      }, 'image/png');
    } catch (err) { alert('이미지 캡처 중 오류가 발생했습니다.'); } finally { setIsCapturing(false); }
  };

  return (
    <div className="w-full flex-1 mb-4 bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-white/10 relative">
      {/* 신고 모달 */}
      {isReportModalOpen && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[70] p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col">
            <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">🚨 사용자 신고</h3>
            <p className="text-xs text-white/50 mb-6">사유를 선택해 주세요. 즉시 대화가 차단됩니다.</p>
            <div className="space-y-2 mb-8">
              {['욕설 및 비하', '음란성 발언', '광고 및 도배', '기타 사유'].map(reason => (
                <button key={reason} onClick={() => setReportReason(reason)} className={`w-full text-left p-4 rounded-xl text-xs font-semibold border ${reportReason === reason ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white/[0.02] border-transparent text-white/50'}`}>{reason}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-3.5 bg-white/5 text-white/70 rounded-xl text-xs font-bold">취소</button>
              <button onClick={handleReportSubmit} className="flex-1 py-3.5 bg-red-900/50 text-red-200 rounded-xl text-xs font-bold">신고 및 나가기</button>
            </div>
          </div>
        </div>
      )}

      {/* 분석 중 / 리포트 출력 */}
      {isAnalyzing && !showAd && !reportData && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-40 backdrop-blur-md">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
          <p className="text-white font-light tracking-widest">분석 중입니다...</p>
        </div>
      )}

      {reportData && !showAd && (
        <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center z-50 p-6 backdrop-blur-xl">
          <div ref={reportCardRef} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
               <h2 className="text-[10px] font-bold tracking-[0.3em] text-white/50">WE US REPORT</h2>
               <span className="text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-1 rounded-full">{tier}</span>
            </div>
            <h2 className="text-lg font-light tracking-widest text-center mb-6 text-white">{isSingleMode ? 'PERSONAL TUTORING' : 'CHEMISTRY ANALYSIS'}</h2>
            <div className="space-y-4 text-xs text-gray-300 whitespace-pre-line leading-relaxed flex-1 bg-white/[0.02] p-5 rounded-2xl border border-white/5">{reportData}</div>
            <div className="mt-4 text-center text-[10px] text-white/30 font-mono">we-us.online</div>
          </div>
          <div className="w-full max-w-sm mt-4 flex gap-3 px-2">
            <button onClick={handleShareCard} disabled={isCapturing} className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 flex justify-center items-center text-sm">{isCapturing ? '처리중...' : '📸 캡처'}</button>
            <button onClick={() => { setReportData(null); forceLeaveRoom(); }} className="px-6 bg-transparent text-white/70 font-semibold py-3 rounded-xl border border-white/10 text-sm">로비</button>
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
              {!isSingleMode && <button onClick={() => setIsReportModalOpen(true)} className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">🚨 신고</button>}
              <button onClick={handleLeaveRoom} className="bg-white/5 text-white/50 text-[10px] px-2 py-0.5 rounded-full">나가기</button>
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
            <div className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed ${msg.sender === myRole || msg.sender === '나' ? 'bg-white text-black rounded-tr-sm' : msg.sender === 'System' ? 'bg-emerald-900/20 text-emerald-100 border border-emerald-500/30 w-full mx-auto text-center' : 'bg-white/10 text-white rounded-tl-sm'}`}>
              {msg.sender !== 'System' && <span className={`text-[10px] block mb-1 font-bold ${msg.sender === myRole || msg.sender === '나' ? 'text-gray-500' : 'text-white/40'}`}>{msg.sender}</span>}
              <span className="whitespace-pre-line">{msg.text}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 연장 투표 버튼 */}
      {timeLeft <= 60 && !isSingleMode && !isAnalyzing && !reportData && extensionCount < 2 && !showAd && (
        <div className="absolute bottom-[70px] left-0 w-full p-2 bg-gradient-to-t from-[#0a0a0a] to-transparent flex flex-col items-center justify-center">
          <button onClick={() => { setHasVoted(true); socketRef.current?.emit('vote_extend', { room }); }} disabled={hasVoted} className={`px-5 py-2 rounded-full font-bold text-xs shadow-lg transition-all border ${hasVoted ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'}`}>
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