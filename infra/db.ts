export const tweetsTable = new sst.aws.Dynamo("Tweets", {
  fields: {
    pk:     "string",
    sk:     "string",
    gsi1pk: "string",
    gsi1sk: "string",
    gsi2pk: "string",
    gsi2sk: "string",
    gsi3pk: "string",
    gsi3sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    QueryByQueryTime: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    QueryByAuthor:    { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
    ByConversation:   { hashKey: "gsi3pk", rangeKey: "gsi3sk" },
  },
  stream: "new-and-old-images",
});

export const aggregatesTable = new sst.aws.Dynamo("Aggregates", {
  fields: {
    pk:     "string",
    sk:     "string",
    gsi1pk: "string",
    gsi1sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    TopK: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  },
});

export const tokensTable = new sst.aws.Dynamo("Tokens", {
  fields: {
    pk:     "string",
    sk:     "string",
    gsi1pk: "string",
    gsi1sk: "string",
    gsi2pk: "string",
    gsi2sk: "string",
    gsi3pk: "string",
    gsi3sk: "string",
    gsi4pk: "string",
    gsi4sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    SpikingByDelta:      { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    WatchlistByMentions: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
    SpikingByDelta24h:   { hashKey: "gsi3pk", rangeKey: "gsi3sk" },
    SpikingByDelta7d:    { hashKey: "gsi4pk", rangeKey: "gsi4sk" },
  },
  stream: "new-and-old-images",
  ttl: "ttl",
});

export const userDataTable = new sst.aws.Dynamo("UserData", {
  fields: {
    pk:     "string",
    sk:     "string",
    gsi1pk: "string",
    gsi1sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    // gsi1pk = BYOK#<provider>, gsi1sk = USER#<userId>
    // Enables Phase 6 jobs to enumerate all users holding a key for a provider.
    ByokHolders: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  },
});

export const authorLocationsTable = new sst.aws.Dynamo("AuthorLocations", {
  fields: {
    pk: "string",
    sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
});
