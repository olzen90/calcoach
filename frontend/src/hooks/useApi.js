import { useState, useCallback } from 'react'

const API_BASE = '/api'

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
      setLoading(false)
      return data
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }, [])

  const get = useCallback((endpoint) => request(endpoint), [request])
  
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
    request(endpoint, {
      method: 'DELETE',
    }), [request])

  const uploadFile = useCallback(async (endpoint, formData) => {
    setLoading(true)
    setError(null)

    try {
      const url = `${API_BASE}${endpoint}`
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error ${response.status}`)
      }

      const data = await response.json()
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

/**
 * Hook for fetching today's meals
 */
export function useTodayMeals() {
  const [meals, setMeals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/meals/today`)
      if (!response.ok) throw new Error('Failed to fetch meals')
      const data = await response.json()
      setMeals(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { meals, loading, error, refresh }
}

/**
 * Hook for fetching stats
 */
export function useStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/stats/full`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
    setLoading(true)
    try {
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]
      const response = await fetch(`${API_BASE}/stats/custom-range?start_date=${startStr}&end_date=${endStr}`)
      if (!response.ok) throw new Error('Failed to fetch custom range stats')
      const data = await response.json()
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
 * Hook for fetching settings
 */
export function useSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/settings/`)
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      setSettings(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { settings, loading, error, refresh, setSettings }
}

/**
 * Hook for fetching progress data
 */
export function useProgress() {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async (days = 90) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/progress/combined?days=${days}`)
      if (!response.ok) throw new Error('Failed to fetch progress')
      const data = await response.json()
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
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/templates/`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json()
      setTemplates(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { templates, loading, error, refresh }
}
