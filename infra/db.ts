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
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    SpikingByDelta:      { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    WatchlistByMentions: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
  },
});

export const userDataTable = new sst.aws.Dynamo("UserData", {
  fields: {
    pk: "string",
    sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
});
