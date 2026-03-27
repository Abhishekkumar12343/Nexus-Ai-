export type PricingModel = 'Free' | 'Freemium' | 'Paid';
export type AppLanguage = 'en' | 'hi' | 'ta' | 'te' | 'hinglish';

export interface Tool {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  imageUrl: string;
  category: string;
  pricingModel: PricingModel;
  tags: string[];
  freeAlternative?: {
    name: string;
    url: string;
  };
}

export interface AiContext {
  goals?: string;
  style?: string;
  work?: string;
}

export interface UserBudget {
  limit: number;
  alertThreshold: number; // percentage, e.g., 80
}

export interface CostRecord {
  id: string;
  timestamp: number;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface PrivacySettings {
  dataLogging: boolean;
  trainingOptOut: boolean;
  retentionDays: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  favorites: string[];
  aiContext?: AiContext;
  language?: AppLanguage;
  role: 'admin' | 'user';
  createdAt: string;
  budget?: UserBudget;
  totalSpend?: number;
  costHistory?: CostRecord[];
  privacy?: PrivacySettings;
}

export interface WorkflowTemplate {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  query: string;
  suggestedContext?: AiContext;
  toolIds: string[];
}
