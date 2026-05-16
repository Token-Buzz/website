import { webDomain } from "./secrets";

if ($app.stage === "production") {
    const zone = cloudflare.getZoneOutput({ filter: { name: webDomain.value } });

    const records: Array<{ name: string; content: string }> = [
        { name: "clerk",           content: "frontend-api.clerk.services" },
        { name: "accounts",        content: "accounts.clerk.services" },
        { name: "clkmail",         content: "mail.umtxdykhpasb.clerk.services" },
        { name: "clk._domainkey",  content: "dkim1.umtxdykhpasb.clerk.services" },
        { name: "clk2._domainkey", content: "dkim2.umtxdykhpasb.clerk.services" },
    ];

    for (const record of records) {
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
