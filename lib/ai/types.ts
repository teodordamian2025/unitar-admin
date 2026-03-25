// lib/ai/types.ts

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string | any[];
};

export type ChatSession = {
  messages: ChatMessage[];
  userId: string;
  userRole: string;
  userName: string;
  createdAt: number;
  lastActivity: number;
};

export type ChatRequest = {
  message: string;
  sessionId: string;
  userId: string;
  userRole: string;
  userName: string;
};

export type ChatResponse = {
  reply: string;
  sessionId: string;
};
