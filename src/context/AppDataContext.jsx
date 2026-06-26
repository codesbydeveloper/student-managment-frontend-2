import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react'

const AppDataContext = createContext(null)

const emptyState = () => ({
  teachers: [],
  classes: [],
  students: [],
  parents: [],
  drivers: [],
})

export function AppDataProvider({ children }) {
  const [state, setState] = useState(emptyState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const setTeachers = useCallback((updater) => {
    setState((s) => ({
      ...s,
      teachers: typeof updater === 'function' ? updater(s.teachers) : updater,
    }))
  }, [])

  const setClasses = useCallback((updater) => {
    setState((s) => ({
      ...s,
      classes: typeof updater === 'function' ? updater(s.classes) : updater,
    }))
  }, [])

  const setStudents = useCallback((updater) => {
    setState((s) => ({
      ...s,
      students: typeof updater === 'function' ? updater(s.students) : updater,
    }))
  }, [])

  const setParents = useCallback((updater) => {
    setState((s) => ({
      ...s,
      parents: typeof updater === 'function' ? updater(s.parents) : updater,
    }))
  }, [])

  const setDrivers = useCallback((updater) => {
    setState((s) => ({
      ...s,
      drivers: typeof updater === 'function' ? updater(s.drivers) : updater,
    }))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      hydrated,
      setTeachers,
      setClasses,
      setStudents,
      setParents,
      setDrivers,
    }),
    [state, hydrated, setTeachers, setClasses, setStudents, setParents, setDrivers],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
