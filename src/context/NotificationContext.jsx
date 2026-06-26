import { createContext, useContext } from 'react'

/** Legacy provider — notifications are loaded from the API only (no browser mock store). */
const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  return <NotificationContext.Provider value={{}}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
} 
