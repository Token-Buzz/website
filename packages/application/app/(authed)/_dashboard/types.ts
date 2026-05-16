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

export interface Spike {
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
  spikes: Spike[]
  sentimentTokens: SentimentToken[]
  narratives: Narrative[]
  stream: StreamPost[]
  alerts: AlertItem[]
}
