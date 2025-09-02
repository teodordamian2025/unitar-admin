// components/Chatbot.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

type Message = {
  from: 'user' | 'bot';
  text: string;
};

export default function Chatbot() {
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
      const format = lower.includes('excel') ? 'xlsx' :
                     lower.includes('pdf') ? 'pdf' :
                     lower.includes('word') || lower.includes('.docx') ? 'docx' :
                     lower.includes('text') || lower.includes('.txt') ? 'txt' :
                     null;

      // 🔁 GENERARE DOCUMENT
      if (format) {
        const endpoint = `/api/genereaza/${format}`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, format }),
        });

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const fileName = `document.${format}`;

        const botMessage: Message = {
          from: 'bot',
          text: `Document generat: <a href="${url}" download="${fileName}">Descarcă ${fileName}</a>`
        };

        setMessages(prev => [...prev, botMessage]);

      } else if (uploadedFile) {
        // 🔁 UPLOAD + INTERPRETARE
        const ext = uploadedFile.name.toLowerCase().split('.').pop();
        const supported = ['pdf', 'xlsx', 'docx', 'txt'];
        const endpoint = supported.includes(ext || '') 
          ? `/api/proceseaza-upload/${ext}`
          : '/api/proceseaza-upload';

        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('prompt', trimmed);

        const res = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        const contentType = res.headers.get('Content-Type') || '';

        if (contentType.startsWith('application/json')) {
          const data = await res.json();
          const botMessage: Message = { from: 'bot', text: data.reply || 'Fără răspuns.' };
          setMessages(prev => [...prev, botMessage]);
        } else {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const fileName = res.headers.get('X-Filename') || uploadedFile.name;

          const botMessage: Message = {
            from: 'bot',
            text: `Document generat: <a href="${url}" download="${fileName}">Descarcă ${fileName}</a>`
          };
          setMessages(prev => [...prev, botMessage]);
        }

        setUploadedFile(null); // resetăm

      } else {
        // 🔁 VERIFICĂ DACĂ ESTE LEGAT DE BAZA DE DATE
        const isDatabaseQuery = lower.includes('client') || lower.includes('proiect') || 
                                lower.includes('factură') || lower.includes('facturi') ||
                                lower.includes('contract') || lower.includes('contracte') ||
                                lower.includes('tranzacți') || lower.includes('bancă') ||
                                lower.includes('subproiect') || lower.includes('adaugă') || 
                                lower.includes('actualizează') || lower.includes('șterge') || 
                                lower.includes('caută') || lower.includes('tabele') || 
                                lower.includes('baza de date') || lower.includes('bigquery') ||
                                lower.includes('câte') || lower.includes('arată') ||
                                lower.includes('lista') || lower.includes('toate') ||
                                lower.includes('structura') || lower.includes('schema') ||
                                lower.includes('inserează') || lower.includes('selectează') ||
                                lower.includes('panoucontrolunitar') || lower.includes('dataset') ||
                                lower.includes('bancatranzactii') || lower.includes('emise') ||
                                lower.includes('primite') || lower.includes('suma') ||
                                lower.includes('buget') || lower.includes('total') ||
                                lower.includes('raport') || lower.includes('statistici') ||
                                lower.includes('confirm') || lower.includes('execută');

        if (isDatabaseQuery) {
          // 🔁 FOLOSEȘTE AI CU BAZA DE DATE
          const res = await fetch('/api/ai-database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: trimmed, sessionId }),
          });

          const data = await res.json();
          
          if (data.success) {
            const botMessage: Message = { from: 'bot', text: data.reply || 'Fără răspuns.' };
            setMessages(prev => [...prev, botMessage]);
          } else {
            // Dacă AI-Database nu funcționează, încearcă cu query normal
            const fallbackRes = await fetch('/api/queryOpenAI', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: trimmed }),
            });

            const fallbackData = await fallbackRes.json();
            const botMessage: Message = { from: 'bot', text: fallbackData.reply || 'Fără răspuns.' };
            setMessages(prev => [...prev, botMessage]);
          }
        } else {
          // 🔁 SIMPLU PROMPT TEXT
          const res = await fetch('/api/queryOpenAI', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed }),
          });

          const data = await res.json();
          const botMessage: Message = { from: 'bot', text: data.reply || 'Fără răspuns.' };
          setMessages(prev => [...prev, botMessage]);
        }
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
        background: '#4caf50',
        color: 'white',
        padding: '10px',
        textAlign: 'center',
        fontWeight: 'bold',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
      }}>
        Asistent AI
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
              {msg.text.startsWith('Document generat') ? (
                <span dangerouslySetInnerHTML={{ __html: msg.text }} />
              ) : msg.text}
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
          placeholder="Scrie un mesaj... (Ctrl+Enter pentru a trimite)"
          style={{
            width: '100%',
            resize: 'none',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '14px'
          }}
        />

        <div {...getRootProps()} style={{
          border: '2px dashed #aaa',
          padding: '6px',
          textAlign: 'center',
          marginTop: '6px',
          cursor: 'pointer',
          borderRadius: '6px',
          background: isDragActive ? '#eee' : '#fafafa'
        }}>
          <input {...getInputProps()} />
          {isDragActive ? 'Lasa fișierele aici...' : 'Încarcă fișier'}
        </div>

        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '8px',
            background: '#4caf50',
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

