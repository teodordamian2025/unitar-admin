// ==================================================================
// CALEA: app/admin/mobil/components/MobileChatbotFAB.tsx
// DATA: 01.05.2026 (Faza 1)
// DESCRIERE: Wrapper peste components/Chatbot.tsx care îl poziționează ca FAB
//            deasupra bottom-nav-ului mobil (nu se suprapune).
// ==================================================================

'use client';

import dynamic from 'next/dynamic';
import { MOBILE_BOTTOM_NAV_HEIGHT } from './MobileBottomNav';

const Chatbot = dynamic(() => import('@/components/Chatbot'), { ssr: false });

interface MobileChatbotFABProps {
  userId?: string;
  userRole?: string;
  userName?: string;
}

export default function MobileChatbotFAB({ userId, userRole, userName }: MobileChatbotFABProps) {
  // FAB-ul e plasat la 16px deasupra bottom-nav-ului (64px + safe area calculată în nav).
  const FAB_BOTTOM_OFFSET = MOBILE_BOTTOM_NAV_HEIGHT + 16;

  return (
    <Chatbot
      userId={userId}
      userRole={userRole}
      userName={userName}
      fabBottomOffset={FAB_BOTTOM_OFFSET}
      fabRightOffset={16}
    />
  );
}
