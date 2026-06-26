import { useCallback, useEffect, useState } from 'react'
import {
  getAppBackgroundSnapshot,
  setAppBackgroundTheme,
  subscribeAppBackgroundTheme,
} from '../utils/appBackgroundTheme'

export function useAppBackgroundTheme() {
  const [theme, setTheme] = useState(() => getAppBackgroundSnapshot())

  useEffect(() => {
    return subscribeAppBackgroundTheme(() => {
      setTheme(getAppBackgroundSnapshot())
    })
  }, [])

  const applyTheme = useCallback((next) => {
    setAppBackgroundTheme(next)
  }, [])

  return { theme, applyTheme }
}
