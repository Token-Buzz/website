export type Sentiment = 'bull' | 'bear' | 'neu'

export interface Token {
  sym: string
  name: string
  price: number
  d24: number
  mentions: number
  dbuzz: number
  sent: Sentiment
  spark: number[]
  live?: boolean
}

export interface LegacySpikeData {
  sym: string
  name: string
  dbuzz: number
  mentions: number
  sent: Sentiment
  spark: number[]
  live?: boolean
  summary: string
}

export interface SentimentToken {
  sym: string
  mentions: number
  score: number
  d: number
}

export interface Narrative {
  title: string
  mentions: number
  growth: number
  tokens: string[]
  handles: number
  summary: string
}

export interface StreamPost {
  handle: string
  followers: string
  time: string
  sent: Sentiment
  text: string
  tick: string
}

export interface AlertItem {
  tone: 'buzz' | 'sent' | 'handle' | 'narrative'
  time: string
  tag: string
  target: string
  body: string
}

export interface Mention {
  handle: string
  followers: string
  time: string
  sent: Sentiment
  text: string
}

export interface HumMessage {
  from: 'hum' | 'you'
  text: string
  sources?: string[]
  time?: string
  contextItems?: { label: string }[]
}

export interface WatchlistGroup {
  id: string
  name: string
  count: number
  color: string
}

export interface DashboardData {
  mentions24h: string
  mentionsDelta: number
  tokenCount: number
  alertCount: number
  alertDelta: number
  netSentiment: number
  sentimentDelta: number
  pulseSeries: number[]
  spikes: LegacySpikeData[]
  sentimentTokens: SentimentToken[]
  narratives: Narrative[]
  stream: StreamPost[]
  alerts: AlertItem[]
}

// ── API response types for new dashboard components ────────────────────────

export type PulsePoint = { bucket: string; count: number };

export type Spike = {
  symbol: string;
  deltaScore: number;
  currentMentions: number;
  priorMentions: number;
  computedAt: string;
};

export type SentimentEntry = {
  symbol: string;
  bullCount: number;
  neutralCount: number;
  bearCount: number;
  avgScore: number;
  tweetCount: number;
};

export type Tweet = {
  tweetId: string;
  query: string;
  text: string;
  authorUsername: string;
  authorName: string;
  authorFollowers: number;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  sentiment?: string;
  sentimentScore?: number;
};

export type KPIs = {
  mentions24h: number;
  tokenCount: number;
  netSentiment: number;
};
