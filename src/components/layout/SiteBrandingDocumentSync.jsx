import { useEffect } from 'react'
import { useSiteBranding } from '../../hooks/useSiteBranding'
import { applySiteBrandingToDocument } from '../../utils/siteBranding'

/** Keeps `document.title` and favicon aligned with site identity after load and saves. */
export function SiteBrandingDocumentSync() {
  const branding = useSiteBranding()

  useEffect(() => {
    applySiteBrandingToDocument(branding)
  }, [branding])

  return null
}
