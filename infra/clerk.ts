import { webDomain } from "./secrets";

const PROD_CLERK_ID = "umtxdykhpasb";

const clerkRecords = [
    { name: "clerk",           content: "frontend-api.clerk.services" },
    { name: "accounts",        content: "accounts.clerk.services" },
    { name: "clkmail",         content: `mail.${PROD_CLERK_ID}.clerk.services` },
    { name: "clk._domainkey",  content: `dkim1.${PROD_CLERK_ID}.clerk.services` },
    { name: "clk2._domainkey", content: `dkim2.${PROD_CLERK_ID}.clerk.services` },
];

if ($app.stage === "production") {
    const zone = cloudflare.getZoneOutput({ filter: { name: webDomain.value } });

    for (const record of clerkRecords) {
        new cloudflare.Record(`clerk-${record.name}`, {
            zoneId: zone.zoneId,
            name: record.name,
            type: "CNAME",
            content: record.content,
            proxied: false,
            ttl: 300,
        });
    }
}
