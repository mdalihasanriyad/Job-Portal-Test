import { FetchError, IMPORT_USER_AGENT, assertPublicHttpsUrl, safeFetchText } from './netSafe.js';

interface Rule {
  allow: boolean;
  pattern: string;
}

const AGENT_TOKEN = 'govtjobbd-importer';

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Minimal robots.txt evaluation (longest matching rule wins; ties favour Allow). */
export function robotsAllows(robotsTxt: string, path: string): boolean {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: field === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }

  const specific = groups.filter((group) => group.agents.some((agent) => agent !== '*' && AGENT_TOKEN.includes(agent)));
  const chosen = specific.length ? specific : groups.filter((group) => group.agents.includes('*'));
  const rules = chosen.flatMap((group) => group.rules);

  let best: Rule | null = null;
  for (const rule of rules) {
    if (!patternToRegex(rule.pattern).test(path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

export interface RobotsVerdict {
  allowed: boolean;
  reason?: string;
}

/** Fetches robots.txt for the feed's host and checks the feed path. 4xx = allowed, 5xx/unreachable = not allowed. */
export async function checkRobots(feedUrl: string): Promise<RobotsVerdict> {
  const url = assertPublicHttpsUrl(feedUrl);
  try {
    const robots = await safeFetchText(`${url.origin}/robots.txt`, { maxBytes: 200_000, timeoutMs: 6000, accept: 'text/plain' });
    return robotsAllows(robots.text, `${url.pathname}${url.search}`)
      ? { allowed: true }
      : { allowed: false, reason: `সাইটের robots.txt এই ফিড আনতে ${IMPORT_USER_AGENT.split('/')[0]}-কে বাধা দিচ্ছে।` };
  } catch (error) {
    if (error instanceof FetchError && error.status !== undefined && error.status >= 400 && error.status < 500) return { allowed: true };
    return { allowed: false, reason: 'robots.txt যাচাই করা যায়নি, তাই নিরাপত্তার জন্য ফিড আনা হয়নি।' };
  }
}
