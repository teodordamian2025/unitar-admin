'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

type Message = {
  from: 'user' | 'bot';
  text: string;
};

interface UserChatbotProps {
  userRole: string | null;
  userPermissions: any;
}

export default function UserChatbot({ userRole, userPermissions }: UserChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = { from: 'user', text: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const lower = trimmed.toLowerCase();
      
      // Verifică dacă utilizatorul încearcă să acceseze informații financiare
      const isFinancialQuery = lower.includes('factură') || lower.includes('facturi') ||
                              lower.includes('plată') || lower.includes('plăți') ||
                              lower.includes('bancă') || lower.includes('tranzacție') ||
                              lower.includes('suma') || lower.includes('valoare') ||
                              lower.includes('buget') || lower.includes('cost') ||
                              lower.includes('financiar') || lower.includes('bani');

      if (isFinancialQuery && userRole === 'normal') {
        const botMessage: Message = { 
          from: 'bot', 
          text: '🚫 Nu ai permisiunea să accesezi informații financiare. Contactează un administrator pentru detalii.' 
        };
        setMessages(prev => [...prev, botMessage]);
        setLoading(false);
        return;
      }

      // Verifică dacă este despre proiecte (permis pentru utilizatori normali)
      const isProjectQuery = lower.includes('proiect') || lower.includes('proiecte') ||
                             lower.includes('timp') || lower.includes('lucrat') ||
                             lower.includes('ore') || lower.includes('activitate') ||
                             lower.includes('raport') || lower.includes('progres') ||
                             lower.includes('deadline') || lower.includes('termen');

      if (isProjectQuery) {
        // Folosește endpoint special pentru utilizatori normali
        const res = await fetch('/api/user-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: trimmed, 
            sessionId,
            userRole,
            userPermissions
          }),
        });

        const data = await res.json();
        const botMessage: Message = { from: 'bot', text: data.reply || 'Fără răspuns.' };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Pentru întrebări generale
        const res = await fetch('/api/queryOpenAI', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });

        const data = await res.json();
        const botMessage: Message = { from: 'bot', text: data.reply || 'Fără răspuns.' };
        setMessages(prev => [...prev, botMessage]);
      }

    } catch (err) {
      console.error('Eroare chatbot:', err);
      setMessages(prev => [...prev, { from: 'bot', text: 'Eroare la conectare cu serverul.' }]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
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

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: '340px',
      background: '#fefefe',
      border: '1px solid #ccc',
      borderRadius: '8px',
      zIndex: 9999,
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '90vh'
    }}>
      <div style={{
        background: userRole === 'admin' ? '#4caf50' : '#2196f3',
        color: 'white',
        padding: '10px',
        textAlign: 'center',
        fontWeight: 'bold',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
      }}>
        Asistent AI - {userRole === 'admin' ? 'Admin' : 'Utilizator'}
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px',
        paddingBottom: '0'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.from === 'user' ? 'right' : 'left', margin: '5px 0' }}>
            <span style={{
              display: 'inline-block',
              padding: '6px 10px',
              borderRadius: '12px',
              background: msg.from === 'user' ? '#dcf8c6' : '#e0e0e0',
              maxWidth: '90%',
              wordWrap: 'break-word'
            }}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
        <textarea
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Întreabă despre proiecte, timp lucrat, rapoarte..."
          style={{
            width: '100%',
            resize: 'none',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '14px'
          }}
        />

        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '8px',
            background: userRole === 'admin' ? '#4caf50' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Se generează...' : 'Trimite'}
        </button>
      </div>
    </div>
  );
}

