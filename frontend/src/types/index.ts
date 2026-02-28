export interface Article {
  id: number;
  source_name: string;
  headline: string;
  snippet: string | null;
  original_url: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  ai_summary: string | null;
  ai_tutorial: string | null;
  processing_status: string;
  created_at: string;
  article_sectors?: { sector_id: number; sectors: Sector }[];
  article_tickers?: Ticker[];
}

export interface Sector {
  id: number;
  name: string;
  category: "world" | "markets";
  slug: string;
}

export interface Ticker {
  ticker: string;
  price: number | null;
  price_change_pct: number | null;
}

export interface Quiz {
  id: number;
  article_id: number;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: number;
  question_text: string;
  options: string[];
  order_num: number;
}

export interface QuizResult {
  score: number;
  total_questions: number;
  xp_earned: number;
  gauge_change: number;
  new_gauge_score: number;
  explanations: QuestionFeedback[];
}

export interface QuestionFeedback {
  question_text: string;
  your_answer: number;
  correct_answer: number;
  is_correct: boolean;
  explanation: string;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  created_at: string;
}

export interface Favorite {
  sector_id: number;
  gauge_score: number;
  gauge_updated_at: string;
  sectors: Sector;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  rank: number;
}

export interface Notification {
  id: number;
  type: "new_article" | "gauge_decay" | "achievement";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}
