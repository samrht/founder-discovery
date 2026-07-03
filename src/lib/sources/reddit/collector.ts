import { RawLead } from "../types";

const UA = () => process.env.REDDIT_USER_AGENT ?? "founder-discovery/1.0";

async function getToken(): Promise<string> {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA(),
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    }),
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Reddit auth: no access_token in response");
  return json.access_token;
}

export async function collectReddit(subreddits: string[], limitPerSub: number): Promise<RawLead[]> {
  const token = await getToken();
  const out: RawLead[] = [];
  for (const sub of subreddits) {
    const res = await fetch(`https://oauth.reddit.com/r/${sub}/new?limit=${limitPerSub}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA() },
    });
    if (!res.ok) {
      console.error(`r/${sub} fetch failed: ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { data?: { children?: Array<{ data: { id: string; permalink: string } }> } };
    for (const child of json.data?.children ?? []) {
      out.push({
        source: "reddit",
        sourceId: child.data.id,
        url: `https://www.reddit.com${child.data.permalink}`,
        payload: child.data,
      });
    }
    await new Promise((r) => setTimeout(r, 1100)); // stay under 60 req/min
  }
  return out;
}
