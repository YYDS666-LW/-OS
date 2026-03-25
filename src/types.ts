import { Timestamp } from 'firebase/firestore';

export interface AIConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  protocol: 'openai-completions' | 'openai-responses' | 'anthropic';
  isDefault?: boolean;
}

export interface TokenUsage {
  daily: number;
  weekly: number;
  monthly: number;
  lastUpdated: string;
}

export interface Novel {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  outline?: string;
  styleGuide?: string;
  background?: string;
  characters?: string;
  plotlines?: string;
  items?: string;
  targetPlatform?: string;
  platformAnalysis?: string;
  authorId: string;
  createdAt: Timestamp;
}

export interface Chapter {
  id: string;
  novelId: string;
  chapterNumber: number;
  title?: string;
  content?: string;
  status: 'draft' | 'auditing' | 'revised' | 'final';
  auditFeedback?: string;
  createdAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  language?: 'zh' | 'en';
  globalRules?: string;
  aiConfigs?: string; // JSON stringified AIConfig[]
  tokenUsage?: string; // JSON stringified TokenUsage
}
