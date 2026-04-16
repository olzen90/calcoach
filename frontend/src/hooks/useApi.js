import { useState, useCallback } from 'react'

const API_BASE = '/api'
const SW_API_CACHE = 'calcoach-api-v1'

// Module-level cache — survives component unmount/remount (page navigation).
// Invalidated on any successful mutation so data stays accurate after writes.
const apiCache = new Map()
let cacheVersion = 0

// Fresh within 5 min: return from cache, no background fetch.
// Stale between 5–30 min: return from cache immediately + background revalidation.
// Beyond 30 min: treat as cache miss, show loading.
const FRESH_TTL = 5 * 60 * 1000
const MAX_STALE_TTL = 30 * 60 * 1000

function getCachedEntry(url) {
  const entry = apiCache.get(url)
  if (!entry) return null
  if (entry.version !== cacheVersion) return null
  const age = Date.now() - entry.timestamp
  if (age > MAX_STALE_TTL) { apiCache.delete(url); return null }
  return { data: entry.data, stale: age > FRESH_TTL }
}

function setCached(url, data) {
  apiCache.set(url, { data, timestamp: Date.now(), version: cacheVersion })
}

function invalidateCache() {
  cacheVersion++
  // Clear service worker API cache too so mutations cause fresh network fetches.
  if (typeof caches !== 'undefined') {
    caches.delete(SW_API_CACHE).catch(() => {})
  }
}

// Fire-and-forget background revalidation — updates state silently, no loading indicator.
function revalidateInBackground(url, setter) {
  fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(data => { if (data) { setCached(url, data); setter(data) } })
    .catch(() => {})
}

/**
 * Custom hook for making API calls
 */
export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = useCallback(async (endpoint, options = {}) => {
    setLoading(true)
    setError(null)

    try {
      const url = `${API_BASE}${endpoint}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error ${response.status}`)
      }

      const data = await response.json()

      const isWrite = options.method && options.method !== 'GET'
      if (isWrite) {
        invalidateCache()
      } else {
        setCached(url, data)
      }

      setLoading(false)
      return data
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }, [])

  // GET with SWR: returns cached data immediately, revalidates in background if stale.
  const get = useCallback(async (endpoint) => {
    const url = `${API_BASE}${endpoint}`
    const entry = getCachedEntry(url)
    if (entry) {
      if (entry.stale) {
        revalidateInBackground(url, (fresh) => setCached(url, fresh))
      }
      return entry.data
    }
    return request(endpoint)
  }, [request])

  const post = useCallback((endpoint, data) =>
    request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }), [request])

  const put = useCallback((endpoint, data) =>
    request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }), [request])

  const del = useCallback((endpoint) =>
    request(endpoint, { method: 'DELETE' }), [request])

  const uploadFile = useCallback(async (endpoint, formData) => {
    setLoading(true)
    setError(null)

    try {
      const url = `${API_BASE}${endpoint}`
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — browser sets it with boundary
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error ${response.status}`)
      }

      const data = await response.json()
      invalidateCache()
      setLoading(false)
      return data
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }, [])

  return { get, post, put, del, uploadFile, loading, error }
}

// ── Shared fetch-with-SWR helper used by all data hooks ──────────────────────

async function fetchWithSWR(cacheKey, setter, setLoadingFn, setErrorFn) {
  const entry = getCachedEntry(cacheKey)
  if (entry) {
    setter(entry.data)
    setLoadingFn(false)
    if (entry.stale) revalidateInBackground(cacheKey, setter)
    return
  }
  setLoadingFn(true)
  try {
    const response = await fetch(cacheKey)
    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
    const data = await response.json()
    setCached(cacheKey, data)
    setter(data)
    if (setErrorFn) setErrorFn(null)
  } catch (err) {
    if (setErrorFn) setErrorFn(err.message)
  } finally {
    setLoadingFn(false)
  }
}

/**
 * Hook for fetching today's meals
 */
export function useTodayMeals() {
  const cacheKey = `${API_BASE}/meals/today`
  // Also try to seed from coach-init cache so CoachView has no loading state on remount.
  const getInitial = () => {
    const direct = getCachedEntry(cacheKey)
    if (direct) return direct.data
    const coachInit = getCachedEntry(`${API_BASE}/meals/coach-init`)
    return coachInit?.data?.today || null
  }
  const [meals, setMeals] = useState(getInitial)
  const [loading, setLoading] = useState(() => !getInitial())
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    await fetchWithSWR(cacheKey, setMeals, setLoading, setError)
  }, [])

  return { meals, loading, error, refresh, setMeals }
}

/**
 * Hook for fetching stats
 */
export function useStats() {
  const cacheKey = `${API_BASE}/stats/full`
  const [stats, setStats] = useState(() => getCachedEntry(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCachedEntry(cacheKey))
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    await fetchWithSWR(cacheKey, setStats, setLoading, setError)
  }, [])

  return { stats, loading, error, refresh }
}

/**
 * Hook for fetching custom date range stats
 */
export function useCustomRangeStats() {
  const [customStats, setCustomStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchRange = useCallback(async (startDate, endDate) => {
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]
    const url = `${API_BASE}/stats/custom-range?start_date=${startStr}&end_date=${endStr}`
    const entry = getCachedEntry(url)
    if (entry) {
      setCustomStats(entry.data)
      setLoading(false)
      if (entry.stale) revalidateInBackground(url, setCustomStats)
      return entry.data
    }
    setLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch custom range stats')
      const data = await response.json()
      setCached(url, data)
      setCustomStats(data)
      setError(null)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setCustomStats(null)
    setError(null)
  }, [])

  return { customStats, loading, error, fetchRange, clear }
}

/**
 * Hook for fetching food frequency data
 */
export function useFoodFrequency() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async (period, startDate = null, endDate = null) => {
    let url = `${API_BASE}/stats/food-frequency?period=${period}`
    if (startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`
    const entry = getCachedEntry(url)
    if (entry) {
      setData(entry.data)
      setLoading(false)
      if (entry.stale) revalidateInBackground(url, setData)
      return entry.data
    }
    setLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch food frequency')
      const result = await response.json()
      setCached(url, result)
      setData(result)
      setError(null)
      return result
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch: fetch_ }
}

/**
 * Hook for AI health assessment
 */
export function useHealthAssessment() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async (period, startDate = null, endDate = null) => {
    let url = `${API_BASE}/stats/health-assessment?period=${period}`
    if (startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`
    const entry = getCachedEntry(url)
    if (entry) {
      setData(entry.data)
      setLoading(false)
      if (entry.stale) revalidateInBackground(url, setData)
      return entry.data
    }
    setLoading(true)
    setData(null)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch health assessment')
      const result = await response.json()
      setCached(url, result)
      setData(result)
      setError(null)
      return result
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch: fetch_ }
}

/**
 * Hook for fetching settings
 */
export function useSettings() {
  const cacheKey = `${API_BASE}/settings/`
  const [settings, setSettings] = useState(() => getCachedEntry(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCachedEntry(cacheKey))
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    await fetchWithSWR(cacheKey, setSettings, setLoading, setError)
  }, [])

  return { settings, loading, error, refresh, setSettings }
}

/**
 * Hook for fetching progress data
 */
export function useProgress() {
  const defaultKey = `${API_BASE}/progress/combined?days=90`
  const [progress, setProgress] = useState(() => getCachedEntry(defaultKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCachedEntry(defaultKey))
  const [error, setError] = useState(null)

  const refresh = useCallback(async (days = 90) => {
    const url = `${API_BASE}/progress/combined?days=${days}`
    const entry = getCachedEntry(url)
    if (entry) {
      setProgress(entry.data)
      setLoading(false)
      if (entry.stale) revalidateInBackground(url, setProgress)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch progress')
      const data = await response.json()
      setCached(url, data)
      setProgress(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { progress, loading, error, refresh }
}

/**
 * Hook for fetching meal templates
 */
export function useTemplates() {
  const cacheKey = `${API_BASE}/templates/`
  const [templates, setTemplates] = useState(() => getCachedEntry(cacheKey)?.data || [])
  const [loading, setLoading] = useState(() => !getCachedEntry(cacheKey))
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    await fetchWithSWR(cacheKey, setTemplates, setLoading, setError)
  }, [])

  return { templates, loading, error, refresh }
}
