const cache = new Map();

export const cacheMiddleware = (ttlMs = 60000) => {
  return (req, res, next) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < ttlMs) {
      return res.json(cached.data);
    }
    res.originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, { ts: Date.now(), data });
      return res.originalJson(data);
    };
    next();
  };
};

export const getCached = (key, ttlMs = 60000) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < ttlMs) {
    return cached.data;
  }
  return null;
};

export const setCached = (key, data, ttlMs = 60000) => {
  cache.set(key, { ts: Date.now(), data });
};

export const clearCache = (prefix = '') => {
  if (!prefix) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  }
};
