// components/Chatbot.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

type Message = {
  from: 'user' | 'bot';
  text: string;
};

interface ChatbotProps {
  userId?: string;
  userRole?: string;
  userName?: string;
}

export default function Chatbot({ userId = 'admin', userRole = 'admin', userName = 'Admin' }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Detectare mobil
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Voice input cu Web Speech API
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
      const lower = trimmed.toLowerCase();

      // Generare documente - păstrăm rutele existente
      const format = lower.includes('excel') ? 'xlsx' :
                     lower.includes('pdf') ? 'pdf' :
                     lower.includes('word') || lower.includes('.docx') ? 'docx' :
                     lower.includes('text') || lower.includes('.txt') ? 'txt' :
                     null;

      if (format) {
        const res = await fetch(`/api/genereaza/${format}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, format }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const fileName = `document.${format}`;
        setMessages(prev => [...prev, {
          from: 'bot',
          text: `Document generat: <a href="${url}" download="${fileName}">Descarcă ${fileName}</a>`
        }]);

      } else if (uploadedFile) {
        // Upload fișier - păstrăm rutele existente
        const ext = uploadedFile.name.toLowerCase().split('.').pop();
        const supported = ['pdf', 'xlsx', 'docx', 'txt'];
        const endpoint = supported.includes(ext || '')
          ? `/api/proceseaza-upload/${ext}`
          : '/api/proceseaza-upload';

        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('prompt', trimmed);

        const res = await fetch(endpoint, { method: 'POST', body: formData });
        const contentType = res.headers.get('Content-Type') || '';

        if (contentType.startsWith('application/json')) {
          const data = await res.json();
          setMessages(prev => [...prev, { from: 'bot', text: data.reply || 'Fără răspuns.' }]);
        } else {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const fileName = res.headers.get('X-Filename') || uploadedFile.name;
          setMessages(prev => [...prev, {
            from: 'bot',
            text: `Document generat: <a href="${url}" download="${fileName}">Descarcă ${fileName}</a>`
          }]);
        }
        setUploadedFile(null);

      } else {
        // Tot restul merge la Claude AI cu tool use
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
      }

    } catch (err) {
      console.error('Eroare chatbot:', err);
      setMessages(prev => [...prev, { from: 'bot', text: 'Eroare la conectare cu serverul.' }]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Pe mobil Enter trimite, pe desktop Ctrl+Enter
    if (isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (!isMobile && e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setMessages(prev => [...prev, {
        from: 'user',
        text: `Am încărcat fișierul: ${file.name}`
      }]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Formatare text cu suport basic markdown
  const formatText = (text: string) => {
    if (text.startsWith('Document generat')) {
      return <span dangerouslySetInnerHTML={{ __html: text }} />;
    }
    // Înlocuiește **text** cu bold și \n cu <br/>
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

  // Butonul FAB când chatbot-ul e închis
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.5)',
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

  // Containerul principal
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            Bună! Sunt asistentul tău AI. Întreabă-mă despre proiecte, sarcini, ore lucrate, sau orice altceva din aplicație.
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
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
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

      {/* Input area */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #eee',
        paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : '12px'
      }}>
        {/* Upload zone - doar pe desktop */}
        {!isMobile && (
          <div {...getRootProps()} style={{
            border: '2px dashed #ddd',
            padding: '6px',
            textAlign: 'center',
            marginBottom: '8px',
            cursor: 'pointer',
            borderRadius: '8px',
            background: isDragActive ? '#f0f0ff' : '#fafafa',
            fontSize: '12px',
            color: '#888'
          }}>
            <input {...getInputProps()} />
            {uploadedFile ? `📎 ${uploadedFile.name}` : (isDragActive ? 'Lasă fișierul aici...' : '📎 Încarcă fișier')}
          </div>
        )}

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

          {/* Buton voce */}
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
              flexShrink: 0,
              transition: 'background 0.2s'
            }}
            title={isListening ? 'Oprește ascultarea' : 'Dictează mesajul'}
          >
            🎤
          </button>

          {/* Buton trimite */}
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
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s'
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
