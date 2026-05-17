import nextConfig from "eslint-config-next";
import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", ".open-next/**", "node_modules/**", "sst-env.d.ts", "next-env.d.ts"] },
  ...nextConfig,
  ...coreWebVitals,
];
export default config;
