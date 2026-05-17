import { webDomain } from "./secrets";

type DnsRecord = { name: string; content: string };

function clerkRecords(stage: "production" | "dev"): DnsRecord[] {
    if (stage === "production") {
        const id = "umtxdykhpasb";
        return [
            { name: "clerk",           content: "frontend-api.clerk.services" },
            { name: "accounts",        content: "accounts.clerk.services" },
            { name: "clkmail",         content: `mail.${id}.clerk.services` },
            { name: "clk._domainkey",  content: `dkim1.${id}.clerk.services` },
            { name: "clk2._domainkey", content: `dkim2.${id}.clerk.services` },
        ];
    }

    const id = "b2r54haimgph";
    return [
        { name: "clerk.dev-app",           content: "frontend-api.clerk.services" },
        { name: "accounts.dev-app",        content: "accounts.clerk.services" },
        { name: "clkmail.dev-app",         content: `mail.${id}.clerk.services` },
        { name: "clk._domainkey.dev-app",  content: `dkim1.${id}.clerk.services` },
        { name: "clk2._domainkey.dev-app", content: `dkim2.${id}.clerk.services` },
    ];
}

if ($app.stage === "production" || $app.stage === "dev") {
    const zone = cloudflare.getZoneOutput({ filter: { name: webDomain.value } });
    const stage = $app.stage as "production" | "dev";

    for (const record of clerkRecords(stage)) {
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
