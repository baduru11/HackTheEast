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
  lesson_data: LessonData | null;
  processing_status: string;
  created_at: string;
  article_sectors?: { sector_id: number; sectors: Sector }[];
  article_tickers?: Ticker[];
}

// --- FLS v1 Lesson Types ---

export interface LessonHeader {
  lesson_title: string;
  difficulty: string;
  read_time_core_min: number;
  read_time_deep_min: number;
  tags: string[];
  learning_outcomes: string[];
  disclaimer: string;
}

export interface WhatHappened {
  event_bullets: string[];
  market_question: string;
  timing_note: string;
}

export interface ConceptCard {
  concept: string;
  plain_meaning: string;
  why_it_moves_prices: string;
  in_this_article: string;
  common_confusion: string;
}

export interface TransmissionRow {
  shock: string;
  channel: string;
  market_variable: string;
  asset_impact: string;
  confidence: string;
}

export interface Edge {
  from_node: string;
  to_node: string;
  relationship: string;
  evidence: string;
  strength: number;
}

export interface MechanismMap {
  transmission_table: TransmissionRow[];
  edge_list: Edge[];
}

export interface AssetImpact {
  asset: string;
  typical_reaction: string;
  direction: string;
  mechanism_driver: string;
  confidence: string;
}

export interface PracticeSkill {
  skill_target: string;
  inputs: string;
  level_zone: string;
  scenario_a: string;
  scenario_b: string;
  what_to_watch: string;
}

export interface LessonQuizQuestion {
  type: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface LessonData {
  header: LessonHeader;
  what_happened: WhatHappened;
  concept_cards: ConceptCard[];
  mechanism_map: MechanismMap;
  asset_impact_matrix: AssetImpact[];
  practice_skill: PracticeSkill;
  quiz: LessonQuizQuestion[];
  sectors: string[];
  summary: string;
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
  question_type: string | null;
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
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  rank: number;
}

export interface Notification {
  id: number;
  type: "new_article" | "gauge_decay" | "achievement" | "friend_request" | "friend_accepted";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

// --- Social Types ---

export interface FriendProfile {
  id: string;
  friendship_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
}

export interface FriendRequest {
  friendship_id: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    total_xp: number;
  };
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
}

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  activity_type: "quiz_completed" | "gauge_milestone" | "streak_milestone";
  metadata: Record<string, unknown>;
  created_at: string;
  reactions: ReactionCount[];
  my_reaction: string | null;
}

// ── Daily Quiz ─────────────────────────────────────────────

export interface DailyQuizQuestion {
  question_text: string;
  options: string[];
}

export interface DailyQuiz {
  id: number;
  date: string;
  questions: DailyQuizQuestion[];
}

export interface DailyQuizExplanation {
  question_text: string;
  your_answer: number;
  correct_answer: number;
  is_correct: boolean;
  explanation: string;
}

export interface DailyQuizResult {
  score: number;
  total_questions: number;
  xp_earned: number;
  explanations: DailyQuizExplanation[];
}

// ── Predict ────────────────────────────────────────────────

export interface PredictStock {
  ticker: string;
  name: string;
  price: number;
  change_24h: number;
}

export interface Prediction {
  id: number;
  ticker: string;
  stock_name: string;
  direction: "up" | "down";
  price_at_bet: number;
  price_at_close: number | null;
  result: "pending" | "win" | "loss";
  xp_earned: number;
  created_at: string;
}
