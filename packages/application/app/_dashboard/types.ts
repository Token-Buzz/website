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
