// NOTE: We intentionally do NOT split routes into separate OpenNext functions.
// A previous `functions.hum` split assigned app/api/hum/chat/route to a dedicated
// streaming Lambda, but SST (v4) did not create that split function from this
// config — while the OpenNext build still honored the split's `routes` and
// dropped chat/route.js from the default server bundle. The result was a runtime
// "Cannot find module .../api/hum/chat/route.js" 500 on every Hum request (#275).
// The default server function already uses the aws-lambda-streaming wrapper, so
// the streaming chat route works correctly inside it with no split needed.
const config = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
    },
  },
};

export default config;
