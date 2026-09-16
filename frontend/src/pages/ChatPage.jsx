import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatAPI, authAPI } from '../services/api';
import io from 'socket.io-client';
import localforage from 'localforage';

// Configure local offline chat database in IndexedDB
const chatStore = localforage.createInstance({
  name: 'DanDanaDB',
  storeName: 'cached_messages'
});

const ROLE_CONFIG = {
  manager: { label: 'مدير', color: '#FF4757', icon: '👑' },
  cashier: { label: 'كاشير', color: '#6C63FF', icon: '🖐️' },
  employee: { label: 'موظف', color: '#00D4AA', icon: '👷' },
};

const MSG_TYPES = {
  leave: { icon: '🌴', label: 'طلب إجازة', bg: 'rgba(108,99,255,0.15)', border: 'rgba(108,99,255,0.3)' },
  late: { icon: '⏰', label: 'إشعار تأخير', bg: 'rgba(255,179,71,0.15)', border: 'rgba(255,179,71,0.3)' },
  absence: { icon: '❌', label: 'إشعار غياب', bg: 'rgba(255,71,87,0.15)', border: 'rgba(255,71,87,0.3)' },
  text: { icon: '💬', label: 'رسالة', bg: null },
};

// Double-chime audio generator using Web Audio API
const playNotificationChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(587.33, now, 0.18); // D5
    playTone(880, now + 0.12, 0.28); // A5
  } catch (e) {
    console.error('Audio chime error:', e);
  }
};

// Custom WhatsApp-style Voice Note Player Component
const AudioMessagePlayer = ({ src }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Playback error:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatSecs = (sec) => {
    if (!sec || isNaN(sec) || !Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="mt-2 p-3 rounded-2xl bg-[#161b26] border border-dark-border flex items-center gap-3 w-64 shadow-lg" dir="ltr">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-accent text-black flex items-center justify-center font-bold text-base hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0"
        title={isPlaying ? 'إيقاف' : 'تشغيل'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Progress & Time */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-dark-border rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
          <span>{formatSecs(currentTime)}</span>
          <span className="text-accent font-semibold flex items-center gap-1">
            <span>🎤</span>
            <span>{duration > 0 ? formatSecs(duration) : 'صوتية'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

const ChatPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState([]);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Users for @mentions
  const [usersList, setUsersList] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionBox, setShowMentionBox] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  // File Upload Ref
  const fileInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    connectSocket();

    // Request Web Push Notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socketRef.current?.disconnect();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const res = await authAPI.getAllUsers();
      if (res.data.success) {
        setUsersList(res.data.users || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchMessages = async () => {
    // 1. Instantly load from local IndexedDB cache (Zero lag, no waiting for network)
    try {
      const cached = await chatStore.getItem('all_messages');
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setMessages(cached);
        setLoading(false);
      }
    } catch (err) {
      console.warn('Local cache read error:', err);
    }

    // 2. Fetch fresh updates from server and sync cache
    try {
      const res = await chatAPI.getMessages();
      if (res.data.success && Array.isArray(res.data.messages)) {
        setMessages(res.data.messages);
        // Persist on device storage so next time it loads instantly without network
        chatStore.setItem('all_messages', res.data.messages).catch(console.error);
      }
    } catch (e) {
      console.error('Fetch messages network error:', e);
    }
    setLoading(false);
  };

  const connectSocket = () => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinChat');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('newMessage', (msg) => {
      setMessages(prev => {
        const next = [...prev, msg];
        chatStore.setItem('all_messages', next).catch(console.error);
        return next;
      });

      // Play chime & show notification if message is from someone else
      if (msg.sender_id !== user?.id && msg.user_id !== user?.id) {
        playNotificationChime();

        const notifTitle = `DanDana 💬 ${msg.full_name || 'رسالة جديدة'}`;
        const notifBody = msg.media_type === 'audio' ? '🎤 رسالة صوتية جديدة' : msg.media_type === 'image' ? '📷 صورة مرفقة' : (msg.message || 'رسالة جديدة');

        // Show lockscreen/system notification via Service Worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: notifTitle,
            body: notifBody,
            icon: '/icons/icon-192.png',
            tag: 'chat-' + (msg.id || Date.now())
          });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(notifTitle, {
              body: notifBody,
              icon: '/icons/icon-192.png'
            });
          } catch (err) {}
        }
      }
    });

    socket.on('typing', ({ name, id }) => {
      if (id !== user?.id) {
        setTyping(prev => {
          if (!prev.includes(name)) return [...prev, name];
          return prev;
        });
        setTimeout(() => {
          setTyping(prev => prev.filter(n => n !== name));
        }, 3000);
      }
    });
  };

  const handleTyping = () => {
    socketRef.current?.emit('typing', { name: user?.full_name, id: user?.id });
  };

  // Start recording audio note
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('متصفحك لا يدعم تسجيل الصوت المباشر.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine best supported audio MIME type (Safari iOS supports mp4/aac, Chrome/Firefox support webm/ogg)
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          sendMediaMessage(base64Audio, 'audio', '🎤 رسالة صوتية');
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250); // Collect slices every 250ms
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Audio record error:', err);
      alert('تعذر الوصول للمايكروفون. يرجى إعطاء الصلاحية في المتصفح.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      audioChunksRef.current = [];
    }
  };

  // Handle Image or Video Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      alert('يرجى اختيار صورة أو مقطع فيديو فقط.');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64Data = reader.result;
      sendMediaMessage(base64Data, isImage ? 'image' : 'video', file.name);
    };
  };

  const sendMediaMessage = async (mediaUrl, mediaType, defaultText) => {
    const msg = {
      sender_id: user.id,
      message: newMsg.trim() || defaultText,
      full_name: user.full_name,
      role: user.role,
      type: msgType,
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
    };
    socketRef.current?.emit('sendMessage', msg);
    setNewMsg('');
    setMsgType('text');
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!newMsg.trim()) return;
    const msg = {
      sender_id: user.id,
      message: newMsg.trim(),
      full_name: user.full_name,
      role: user.role,
      type: msgType,
      media_url: null,
      media_type: 'text',
      created_at: new Date().toISOString(),
    };
    socketRef.current?.emit('sendMessage', msg);
    setNewMsg('');
    setMsgType('text');
    setShowMentionBox(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMsg(val);
    handleTyping();

    // Check for @mention trigger
    const lastWord = val.split(' ').pop();
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      setMentionQuery(lastWord.slice(1).toLowerCase());
      setShowMentionBox(true);
    } else {
      setShowMentionBox(false);
    }
  };

  const insertMention = (u) => {
    const words = newMsg.split(' ');
    words.pop();
    words.push(`@${u.full_name} `);
    setNewMsg(words.join(' '));
    setShowMentionBox(false);
  };

  const filteredUsers = usersList.filter(u =>
    u.full_name.toLowerCase().includes(mentionQuery) ||
    u.username.toLowerCase().includes(mentionQuery)
  );

  const isMe = (msg) => msg.sender_id === user?.id || msg.user_id === user?.id;

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getAvatar = (role, name) => {
    const rc = ROLE_CONFIG[role] || ROLE_CONFIG.employee;
    return { color: rc.color, letter: name?.[0] || '?' };
  };

  // Render text with highlighted @mentions
  const renderMessageContent = (msg) => {
    const text = msg.message || '';
    const parts = text.split(/(@[^\s]+)/g);

    return (
      <div className="space-y-2">
        {text && (
          <p style={{ color: 'var(--text-primary)' }}>
            {parts.map((p, idx) => {
              if (p.startsWith('@')) {
                return (
                  <span key={idx} className="font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent mx-0.5">
                    {p}
                  </span>
                );
              }
              return p;
            })}
          </p>
        )}

        {/* Media Attachments */}
        {msg.media_url && msg.media_type === 'audio' && (
          <AudioMessagePlayer src={msg.media_url} />
        )}

        {msg.media_url && msg.media_type === 'image' && (
          <div className="mt-2 rounded-xl overflow-hidden max-w-xs border border-dark-border">
            <img src={msg.media_url} alt="مرفق" className="w-full object-cover max-h-60" />
          </div>
        )}

        {msg.media_url && msg.media_type === 'video' && (
          <div className="mt-2 rounded-xl overflow-hidden max-w-xs border border-dark-border">
            <video controls src={msg.media_url} className="w-full max-h-60" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 100px)' }} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 animate-fadeInUp flex-shrink-0">
        <div>
          <h1 className="page-title">💬 الدردشة الجماعية</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>جروب دندنه – رسائل نصية وصوتية، صور، إشارات، وإشعارات حية</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: connected ? 'rgba(0,212,170,0.1)' : 'rgba(255,71,87,0.1)', border: `1px solid ${connected ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}` }}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'status-online' : 'status-offline'}`} />
          <span className="text-xs font-semibold" style={{ color: connected ? 'var(--accent)' : '#FF4757' }}>
            {connected ? 'متصل بالدردشة' : 'غير متصل'}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="glass-card-static flex-1 flex flex-col overflow-hidden animate-fadeInUp delay-100">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-area" id="messages-container">
          {loading ? (
            <div className="flex justify-center py-12"><div className="spinner" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 opacity-40">
              <p className="text-5xl mb-3">💬</p>
              <p style={{ color: 'var(--text-muted)' }}>ابدأ المحادثة مع فريقك!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const mine = isMe(msg);
              const av = getAvatar(msg.role, msg.full_name);
              const rc = ROLE_CONFIG[msg.role] || ROLE_CONFIG.employee;
              const mt = MSG_TYPES[msg.type] || MSG_TYPES.text;

              return (
                <div key={i} className={`flex gap-3 animate-fadeInUp ${mine ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className="avatar w-9 h-9 text-sm flex-shrink-0 self-end mb-1"
                    style={{ background: `linear-gradient(135deg, ${av.color}, ${av.color}80)`, boxShadow: `0 0 10px ${av.color}40` }}>
                    {av.letter}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col gap-1 max-w-xs md:max-w-md ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-semibold" style={{ color: av.color }}>{msg.full_name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rc.icon} {rc.label}</span>
                      </div>
                    )}

                    {msg.type && msg.type !== 'text' ? (
                      <div className="p-3 rounded-2xl text-sm"
                        style={{ background: mt.bg, border: `1px solid ${mt.border}`, minWidth: '180px' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span>{mt.icon}</span>
                          <span className="font-bold text-xs" style={{ color: 'var(--text-secondary)' }}>{mt.label}</span>
                        </div>
                        {renderMessageContent(msg)}
                      </div>
                    ) : (
                      <div className={`px-4 py-3 text-sm leading-relaxed ${mine ? 'chat-bubble-mine' : 'chat-bubble-other'}`}>
                        {renderMessageContent(msg)}
                      </div>
                    )}

                    <span className="text-xs px-1" style={{ color: 'var(--text-muted)', fontFamily: 'Inter' }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {typing.length > 0 && (
            <div className="flex gap-3 animate-fadeInUp">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs"
                style={{ background: 'var(--dark-surface)', color: 'var(--text-muted)' }}>
                <span>✍️</span>
                <span>{typing.join('، ')} {typing.length === 1 ? 'بيكتب' : 'بيكتبوا'}...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Mention Box Dropdown */}
        {showMentionBox && filteredUsers.length > 0 && (
          <div className="px-4 py-2 bg-dark-card border-t border-dark-border max-h-36 overflow-y-auto flex flex-col gap-1">
            <span className="text-xs text-muted mb-1">👥 اختر موظف للإشارة إليه:</span>
            {filteredUsers.slice(0, 5).map(u => (
              <button
                key={u.id}
                onClick={() => insertMention(u)}
                className="text-right p-2 rounded-lg text-xs font-bold hover:bg-white/5 flex items-center justify-between text-text-primary"
              >
                <span>@{u.full_name}</span>
                <span className="text-muted font-normal">{u.role}</span>
              </button>
            ))}
          </div>
        )}

        {/* Type selector */}
        <div className="px-4 pt-3 border-t flex gap-2 overflow-x-auto" style={{ borderColor: 'var(--dark-border)' }}>
          {[
            { id: 'text', icon: '💬', label: 'رسالة' },
            { id: 'leave', icon: '🌴', label: 'إجازة' },
            { id: 'late', icon: '⏰', label: 'تأخير' },
            { id: 'absence', icon: '❌', label: 'غياب' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setMsgType(t.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
              style={msgType === t.id
                ? { background: 'rgba(108,99,255,0.3)', color: 'var(--primary-light)', border: '1px solid rgba(108,99,255,0.5)' }
                : { background: 'rgba(26,26,53,0.6)', color: 'var(--text-muted)', border: '1px solid var(--dark-border)' }}
              id={`msg-type-${t.id}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-dark-border flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*"
            style={{ display: 'none' }}
          />

          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-dark-card border border-dark-border hover:border-accent text-text-muted hover:text-white transition-colors"
            title="إرفاق صورة أو فيديو"
          >
            📎
          </button>

          {/* Audio Recording UI */}
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-red-400">جاري تسجيل صوتي ({recordSeconds} ثانية)...</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3 py-1 bg-accent text-black text-xs font-bold rounded-lg"
                >
                  ✅ إرسال
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1 bg-dark text-white text-xs font-bold rounded-lg"
                >
                  ✕ إلغاء
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <input
                  id="chat-input"
                  type="text"
                  value={newMsg}
                  onChange={handleInputChange}
                  placeholder={msgType === 'text' ? 'اكتب رسالتك أو @ للإشارة لموظف...' : `${MSG_TYPES[msgType]?.icon} اكتب ${MSG_TYPES[msgType]?.label}...`}
                  className="input-dark w-full pl-10"
                  autoComplete="off"
                />
                {newMsg.trim() && (
                  <button
                    type="button"
                    onClick={() => setNewMsg('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted hover:text-white"
                  >✕</button>
                )}
              </div>

              {/* Mic Voice Note Button */}
              <button
                type="button"
                onClick={startRecording}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-dark-card border border-dark-border hover:border-accent text-text-muted hover:text-accent transition-colors"
                title="تسجيل رسالة صوتية (Voice Note)"
              >
                🎤
              </button>

              {/* Send Text Button */}
              <button
                type="submit"
                disabled={!newMsg.trim()}
                className="btn-primary px-5 disabled:opacity-40 disabled:cursor-not-allowed"
                id="send-btn"
              >
                ↩
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;