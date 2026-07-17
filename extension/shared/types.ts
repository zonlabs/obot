export interface ProductData {
  name: string;
  price: number;
  currency: string;
  store: string;
  url: string;
  rating: number | null;
  reviewCount: number | null;
  image: string | null;
  specs: Record<string, string>;
  description: string;
}

export interface CanvasState {
  tabs: Record<number, ProductData>;
  activeTabId: number | null;
}

export interface ChatRequest {
  prompt: string;
  canvas: ProductData[];
  sessionId: string;
}

export interface ChatResponse {
  message: string;
  structured: Record<string, unknown> | null;
}

export interface PricePoint {
  price: number;
  currency: string;
  timestamp: string;
  store: string;
  url: string;
}

export interface PremiumUser {
  id: string;
  email: string;
  plan: 'free' | 'premium';
}
