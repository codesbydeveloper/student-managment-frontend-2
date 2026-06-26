import { useEffect, useState } from 'react'
import { subscribeTransportAssignments } from './transportAssignmentStore'

/** Bumps when admin changes parent/driver ↔ bus overrides (localStorage). */
export function useTransportAssignmentRevision() {
  const [rev, setRev] = useState(0)
  useEffect(() => subscribeTransportAssignments(() => setRev((x) => x + 1)), [])
  return rev
}
