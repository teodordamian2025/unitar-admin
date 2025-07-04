'use client';
import { useState } from 'react';

export default function Page() {
  const [aiText, setAiText] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  const [project, setProject] = useState({
    nume: '',
    client: '',
    valoare: '',
    termen: ''
  });

  const [docText, setDocText] = useState('');
  const [docResponse, setDocResponse] = useState('');

  const handleAiSubmit = async () => {
    const res = await fetch('https://webhook-ul-tau.ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: aiText })
    });
    const data = await res.json();
    setAiResponse(JSON.stringify(data));
  };

  const handleProjectSubmit = () => {
    alert(`Proiect salvat:\n${JSON.stringify(project, null, 2)}`);
  };

  const handleDocGenerate = () => {
    setDocResponse(`📝 Generăm automat document pentru: ${docText}`);
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold text-center">Panou de management Unitar Proiect TDA</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">Introducere date prin AI</h2>
        <textarea
          className="w-full p-2 border rounded"
          rows={3}
          placeholder="Ex: Am emis o factură de 4200 lei pentru clientul X"
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
        />
        <button onClick={handleAiSubmit} className="mt-2 px-4 py-2 bg-black text-white rounded">
          Trimite
        </button>
        {aiResponse && <pre className="mt-3 bg-gray-100 p-2 rounded">{aiResponse}</pre>}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Adaugă proiect nou</h2>
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Nume proiect"
          value={project.nume}
          onChange={(e) => setProject({ ...project, nume: e.target.value })}
        />
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Client"
          value={project.client}
          onChange={(e) => setProject({ ...project, client: e.target.value })}
        />
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Valoare (lei)"
          value={project.valoare}
          onChange={(e) => setProject({ ...project, valoare: e.target.value })}
        />
        <input
          className="w-full mb-2 p-2 border rounded"
          placeholder="Termen (ex: 30 septembrie)"
          value={project.termen}
          onChange={(e) => setProject({ ...project, termen: e.target.value })}
        />
        <button onClick={handleProjectSubmit} className="mt-2 px-4 py-2 bg-black text-white rounded">
          Salvează proiect
        </button>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Completare document automat</h2>
        <textarea
          className="w-full p-2 border rounded"
          rows={3}
          placeholder="Ex: Generează un contract pentru clientul X pentru suma de 5000 lei"
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
        />
        <button onClick={handleDocGenerate} className="mt-2 px-4 py-2 bg-black text-white rounded">
          Generează document
        </button>
        {docResponse && <p className="mt-2">{docResponse}</p>}
      </section>
    </main>
  );
}
