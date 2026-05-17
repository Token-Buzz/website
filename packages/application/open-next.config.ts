export default {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
    },
  },
  functions: {
    hum: {
      routes: ["app/api/hum/chat/route"],
      patterns: ["/api/hum/*"],
      override: {
        wrapper: "aws-lambda-streaming",
        converter: "aws-apigw-v2",
      },
    },
  },
};
