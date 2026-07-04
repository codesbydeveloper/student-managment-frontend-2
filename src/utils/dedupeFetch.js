const inflight = new Map()
/** @type {Map<string, unknown>} */
const results = new Map()

export const PUBLIC_APPEARANCE_KEYS = {
  siteIdentity: 'public:site-identity',
  loginAppearance: 'public:login-appearance',
  backgroundAppearance: 'public:background-appearance',
  sidebarMenuAppearance: 'public:sidebar-menu-appearance',
  buttonAppearance: 'public:button-appearance',
  iconAppearance: 'public:icon-appearance',
}

function shouldCacheResult(result) {
  return Boolean(result && typeof result === 'object' && result.ok === true)
}

/**
 * Coalesce concurrent calls and reuse the last successful result for the session.
 * Failed responses are never cached.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} factory
 * @returns {Promise<T>}
 */
export function dedupeFetch(key, factory) {
  if (results.has(key)) return Promise.resolve(results.get(key))

  const existing = inflight.get(key)
  if (existing) return existing

  const promise = Promise.resolve()
    .then(factory)
    .then((result) => {
      if (shouldCacheResult(result)) results.set(key, result)
      return result
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

/** Store a fresh successful API result (e.g. right after admin save). */
export function seedDedupeFetch(key, result) {
  if (shouldCacheResult(result)) results.set(key, result)
  inflight.delete(key)
}

/** Drop cached result + in-flight promise so the next call fetches fresh data. */
export function bustDedupeFetch(key) {
  inflight.delete(key)
  results.delete(key)
}

/** Clear every cached public appearance response (e.g. after sign-out). */
export function bustAllPublicAppearanceFetches() {
  for (const key of Object.values(PUBLIC_APPEARANCE_KEYS)) {
    bustDedupeFetch(key)
  }
}

let publicAppearanceReady = false

/** Called once after the initial parallel appearance load in main.jsx. */
export function markPublicAppearanceReady() {
  publicAppearanceReady = true
}

export function isPublicAppearanceReady() {
  return publicAppearanceReady
}

/** Skip reusing the index.html boot promise on the next site-identity read. */
export function invalidateSiteIdentityBootFetch() {
  if (typeof window !== 'undefined') {
    delete window.__SM_SITE_IDENTITY_BOOT__
  }
  bustDedupeFetch(PUBLIC_APPEARANCE_KEYS.siteIdentity)
}
