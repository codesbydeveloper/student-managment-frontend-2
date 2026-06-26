import { useCallback, useEffect, useState } from 'react'
import { fetchMyProfile } from '../api/profileApi'
import {
  getProfilePrefs,
  setProfilePrefs,
  subscribeProfilePrefs,
  syncProfileFromApi,
} from '../utils/profileStorage'

/**
 * Display name + profile photo from API (with local cache for fast header paint).
 * @param {string|number|null|undefined} userId
 * @param {string} fallbackName
 * @param {string|null|undefined} token
 */
export function useProfilePrefs(userId, fallbackName = '', token = null) {
  const [prefs, setPrefs] = useState(() =>
    userId ? getProfilePrefs(userId) : { displayName: '', profileImage: '' },
  )
  const [loading, setLoading] = useState(Boolean(token && userId))

  const applyPrefs = useCallback((next) => {
    setPrefs({
      displayName: String(next.displayName ?? '').trim(),
      profileImage: String(next.profileImage ?? '').trim(),
    })
  }, [])

  const refresh = useCallback(() => {
    if (!userId) {
      applyPrefs({ displayName: '', profileImage: '' })
      return Promise.resolve()
    }
    applyPrefs(getProfilePrefs(userId))
    if (!token) return Promise.resolve()

    setLoading(true)
    return fetchMyProfile(token)
      .then((res) => {
        if (res.ok && res.profile) {
          syncProfileFromApi(userId, res.profile)
          applyPrefs(getProfilePrefs(userId))
        }
      })
      .finally(() => setLoading(false))
  }, [userId, token, applyPrefs])

  useEffect(() => {
    if (!userId) {
      applyPrefs({ displayName: '', profileImage: '' })
      setLoading(false)
      return
    }
    applyPrefs(getProfilePrefs(userId))
    if (!token) {
      setLoading(false)
      return
    }
    void refresh()
  }, [userId, token]) 

  useEffect(() => {
    const onLocalUpdate = () => {
      if (userId) applyPrefs(getProfilePrefs(userId))
    }
    return subscribeProfilePrefs(onLocalUpdate)
  }, [userId, applyPrefs])

  const displayName = (prefs.displayName || fallbackName || 'User').trim()

  return {
    displayName,
    profileImage: prefs.profileImage,
    loading,
    refresh,
    /** After a successful API mutation that returns profile */
    applyApiProfile: (profile) => {
      if (!userId || !profile) return
      syncProfileFromApi(userId, profile)
      applyPrefs(getProfilePrefs(userId))
    },
    cacheDisplayName: (name) => {
      if (!userId) return
      setProfilePrefs(userId, { displayName: name })
      applyPrefs(getProfilePrefs(userId))
    },
  }
}
