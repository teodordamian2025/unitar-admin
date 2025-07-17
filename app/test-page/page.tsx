'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const Chatbot = dynamic(() => import('@/components/Chatbot'), { ssr: false });

export default function TestChatPage() {
  useEffect(() => {
    console.log('✅ Pagina de test a fost încărcată');
  }, []);

  return (
    <div>
      <h2>Test Chatbot</h2>
      <Chatbot />
    </div>
  );
}
