const redisUrl = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.REDIS_REST_URL)?.replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.REDIS_REST_TOKEN;

async function redisRequest(path: string, init?: RequestInit): Promise<Response | null> {
  if (!redisUrl || !redisToken) return null;
  try {
    return await fetch(`${redisUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${redisToken}`, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const response = await redisRequest(`/get/${encodeURIComponent(key)}`);
  if (!response?.ok) return null;
  try {
    const data = await response.json() as { result?: string | null };
    return data.result ? JSON.parse(data.result) as T : null;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
  await redisRequest("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(["SET", key, JSON.stringify(value), "EX", ttlSeconds]) });
}

export async function deleteCached(key: string): Promise<void> {
  await redisRequest("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(["DEL", key]) });
}

export async function getConversationState<T>(userId: string, sessionId: string): Promise<T | null> {
  return getCached<T>(`conversations:state:${userId}:${sessionId}`);
}

export async function setConversationState<T>(userId: string, sessionId: string, value: T, ttlSeconds = 60 * 60): Promise<void> {
  await setCached(`conversations:state:${userId}:${sessionId}`, value, ttlSeconds);
}

export async function clearConversationState(userId: string, sessionId: string): Promise<void> {
  await deleteCached(`conversations:state:${userId}:${sessionId}`);
}

export async function invalidateConversationCache(userId: string, sessionId: string): Promise<void> {
  await Promise.all([
    deleteCached(`conversations:list:v3:${userId}`),
    ...Array.from({ length: 20 }, (_, page) => deleteCached(`conversations:events:${userId}:${sessionId}:${page}`)),
  ]);
}
