import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ddb } from "./client";
import { listWatchlistEntries } from "./watchlist-entries";

export type Watchlist = {
  id: string;
  userId: string;
  name: string;
  queries: string[];
  createdAt: string;
  updatedAt: string;
};

export async function putWatchlist(watchlist: Watchlist): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: Resource.UserData.name,
      Item: {
        pk: `USER#${watchlist.userId}`,
        sk: `WATCHLIST#${watchlist.id}`,
        ...watchlist,
      },
    })
  );
}

export async function getWatchlists(userId: string): Promise<Watchlist[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Resource.UserData.name,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "WATCHLIST#",
      },
    })
  );

  return (result.Items || []).map((item: any) => ({
    id: item.id,
    userId: item.userId,
    name: item.name,
    queries: item.queries || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function getAllTrackedQueries(userId: string): Promise<string[]> {
  const [watchlists, entries] = await Promise.all([
    getWatchlists(userId),
    listWatchlistEntries(userId),
  ]);
  const queries = new Set<string>();

  watchlists.forEach((wl) => {
    (wl.queries || []).forEach((q) => queries.add(q));
  });

  entries.forEach((entry) => {
    if (entry.query) queries.add(entry.query);
  });

  return Array.from(queries);
}
