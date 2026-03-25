// app/components/UserChatbot.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Message = {
  from: 'user' | 'bot';
  text: string;
};

interface UserChatbotProps {
  userId: string;
  userRole: string;
  userName: string;
}

export default function UserChatbot({ userId, userRole, userName }: UserChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { from: 'bot', text: 'Browser-ul nu suportă recunoașterea vocală. Folosește Chrome sau Safari.' }]);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ro-RO';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = { from: 'user', text: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Tot merge la Claude AI - restricțiile de rol se fac pe backend prin filtrarea tools
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          userId,
          userRole,
          userName
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { from: 'bot', text: `⚠️ ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { from: 'bot', text: data.reply || 'Fără răspuns.' }]);
      }

    } catch (err) {
      console.error('Eroare chatbot:', err);
      setMessages(prev => [...prev, { from: 'bot', text: 'Eroare la conectare cu serverul.' }]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (!isMobile && e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          return part.split('\n').map((line, j) => (
            <span key={`${i}-${j}`}>
              {j > 0 && <br />}
              {line}
            </span>
          ));
        })}
      </>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '24px' : '20px',
          right: isMobile ? '24px' : '20px',
          height: isMobile ? '56px' : '56px',
          borderRadius: isMobile ? '28px' : '50%',
          padding: isMobile ? '0 20px 0 16px' : '0',
          width: isMobile ? 'auto' : '56px',
          minWidth: isMobile ? undefined : '56px',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(79, 172, 254, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? '8px' : '0',
          fontSize: '24px',
          transition: 'transform 0.2s'
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        title="Asistent AI"
      >
        <span>🤖</span>
        {isMobile && <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Asistent AI</span>}
      </button>
    );
  }

  const containerStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100dvh',
    background: '#fefefe',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } : {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '380px',
    maxHeight: '70vh',
    background: '#fefefe',
    border: '1px solid #e0e0e0',
    borderRadius: '16px',
    zIndex: 9999,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        padding: isMobile ? '16px 20px' : '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopLeftRadius: isMobile ? 0 : '16px',
        borderTopRightRadius: isMobile ? 0 : '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Asistent UNITAR</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </div>

      {/* Mesaje */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        paddingBottom: '4px',
        minHeight: isMobile ? undefined : '200px'
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#888',
            padding: '20px',
            fontSize: '14px'
          }}>
            Bună, {userName}! Sunt asistentul tău AI. Întreabă-mă despre proiectele tale, sarcini, ore lucrate, sau orice altceva.
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
            margin: '6px 0'
          }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: msg.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.from === 'user'
                ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                : '#f0f0f5',
              color: msg.from === 'user' ? 'white' : '#333',
              maxWidth: '85%',
              wordWrap: 'break-word',
              fontSize: '14px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap'
            }}>
              {formatText(msg.text)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '6px 0' }}>
            <div style={{
              padding: '8px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: '#f0f0f5',
              color: '#888',
              fontSize: '14px'
            }}>
              Se gândește...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #eee',
        paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            rows={isMobile ? 1 : 2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMobile ? 'Scrie un mesaj...' : 'Scrie un mesaj... (Ctrl+Enter)'}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px solid #ddd',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.4'
            }}
          />

          <button
            onClick={toggleVoice}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: isListening ? '#ef4444' : '#f0f0f5',
              color: isListening ? 'white' : '#666',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title={isListening ? 'Oprește ascultarea' : 'Dictează mesajul'}
          >
            🎤
          </button>

          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: loading || !input.trim()
                ? '#ddd'
                : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
