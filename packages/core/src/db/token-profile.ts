import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { tokenProfileKey } from './keys'

export interface TokenProfileRecord {
  symbol: string
  websiteUrl?: string
  pressUrl?: string
  pressFeedUrl?: string
  newsKeywords?: string[]      // M14
  githubUrl?: string
  contractAddress?: string
  chain?: string
  source: 'seed' | 'user' | 'curated'
  updatedAt: string
}

/**
 * Returns the token profile for a given symbol, or null if none exists.
 * The PROFILE child item lives on the Tokens table at pk=TOKEN#<SYM>, sk=PROFILE.
 */
export async function getTokenProfile(symbol: string): Promise<TokenProfileRecord | null> {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TableNames.tokens,
    Key: tokenProfileKey(symbol),
  }))
  if (!Item) return null

  return {
    symbol: Item['symbol'] as string,
    ...(Item['websiteUrl'] !== undefined && { websiteUrl: Item['websiteUrl'] as string }),
    ...(Item['pressUrl'] !== undefined && { pressUrl: Item['pressUrl'] as string }),
    ...(Item['pressFeedUrl'] !== undefined && { pressFeedUrl: Item['pressFeedUrl'] as string }),
    ...(Item['newsKeywords'] !== undefined && { newsKeywords: Item['newsKeywords'] as string[] }),
    ...(Item['githubUrl'] !== undefined && { githubUrl: Item['githubUrl'] as string }),
    ...(Item['contractAddress'] !== undefined && { contractAddress: Item['contractAddress'] as string }),
    ...(Item['chain'] !== undefined && { chain: Item['chain'] as string }),
    source: Item['source'] as 'seed' | 'user' | 'curated',
    updatedAt: Item['updatedAt'] as string,
  }
}

/**
 * Writes (or overwrites) a token profile on the Tokens table.
 * Always uppercases the symbol and stamps updatedAt.
 */
export async function upsertTokenProfile(
  profile: Omit<TokenProfileRecord, 'updatedAt'>,
): Promise<void> {
  const sym = profile.symbol.toUpperCase()
  const keys = tokenProfileKey(sym)
  const updatedAt = new Date().toISOString()

  await ddb.send(new PutCommand({
    TableName: TableNames.tokens,
    Item: {
      ...keys,
      symbol: sym,
      source: profile.source,
      ...(profile.websiteUrl !== undefined && { websiteUrl: profile.websiteUrl }),
      ...(profile.pressUrl !== undefined && { pressUrl: profile.pressUrl }),
      ...(profile.pressFeedUrl !== undefined && { pressFeedUrl: profile.pressFeedUrl }),
      ...(profile.newsKeywords !== undefined && { newsKeywords: profile.newsKeywords }),
      ...(profile.githubUrl !== undefined && { githubUrl: profile.githubUrl }),
      ...(profile.contractAddress !== undefined && { contractAddress: profile.contractAddress }),
      ...(profile.chain !== undefined && { chain: profile.chain }),
      updatedAt,
    },
  }))
}
