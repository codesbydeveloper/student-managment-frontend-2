import { useCallback, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { syncPageFromApi } from '../../utils/pagination'
import { toast } from 'react-toastify'
import {
  deleteNotificationBannerAsset,
  fetchNotificationBannerAssets,
} from '../../api/notificationsApi'
import { useConfirm } from '../../context/ConfirmContext'
import { Modal } from '../Modal'
import { Button } from '../ui/Button'

function deleteParamsForAsset(asset) {
  if (!asset) return null
  const fileName = String(asset.fileName ?? '').trim()
  if (fileName) return { fileName }
  const bannerImageUrl = String(asset.url ?? '').trim()
  if (bannerImageUrl) return { bannerImageUrl }
  return null
}

/**
 * Browse previously uploaded notice banners (GET /api/notifications/banner-assets).
 */
export function BannerAssetPicker({
  token,
  open,
  onClose,
  selectedId,
  onSelect,
  canDelete = false,
}) {
  const confirm = useConfirm()
  const [assets, setAssets] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteIds, setDeleteIds] = useState(() => new Set())

  const pendingAsset = assets.find((a) => a.id === pendingId) ?? null
  const deleteCount = deleteIds.size

  const exitDeleteMode = () => {
    setDeleteMode(false)
    setDeleteIds(new Set())
  }

  useAsyncLoader(
    async () => {
      if (!open) return
      setAssets([])
      setPendingId(selectedId ?? null)
      exitDeleteMode()
      if (!token) {
        setError('Sign in to browse uploaded banners.')
        setAssets([])
        return
      }
      setLoading(true)
      setError('')
      const res = await fetchNotificationBannerAssets(token, { page: 1, limit: 24 })
      setLoading(false)
      if (!res.ok) {
        setError(res.error || 'Could not load banner library.')
        setAssets([])
        return
      }
      setHasNext(res.hasNext)
      syncPageFromApi(setPage, res.page)
      setAssets(res.assets)
    },
    [token, open, selectedId],
    { enabled: open },
  )

  const loadPage = useCallback(
    async (pageNum, append) => {
      if (!token) {
        setError('Sign in to browse uploaded banners.')
        setAssets([])
        return
      }
      setLoading(true)
      setError('')
      const res = await fetchNotificationBannerAssets(token, { page: pageNum, limit: 24 })
      setLoading(false)
      if (!res.ok) {
        setError(res.error || 'Could not load banner library.')
        if (!append) setAssets([])
        return
      }
      setHasNext(res.hasNext)
      syncPageFromApi(setPage, res.page)
      setAssets((prev) => (append ? [...prev, ...res.assets] : res.assets))
    },
    [token],
  )

  const handleClose = () => {
    if (deleting) return
    exitDeleteMode()
    onClose()
  }

  const applySelection = () => {
    if (!pendingAsset) {
      toast.error('Select a banner image first.')
      return
    }
    onSelect(pendingAsset)
    handleClose()
  }

  const toggleDeleteId = (id) => {
    setDeleteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllOnPage = () => {
    setDeleteIds((prev) => {
      const next = new Set(prev)
      for (const a of assets) next.add(a.id)
      return next
    })
  }

  const clearDeleteSelection = () => {
    setDeleteIds(new Set())
  }

  const onDeleteBulk = async () => {
    if (!canDelete || !deleteMode || deleteCount === 0 || deleting) return

    const toDelete = assets.filter((a) => deleteIds.has(a.id))
    const ok = await confirm({
      title: `Delete ${toDelete.length} banner${toDelete.length === 1 ? '' : 's'}?`,
      message: 'These images will be removed from the library permanently. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return

    setDeleting(true)
    let removed = 0
    let failed = 0
    const removedIds = new Set()

    try {
      for (const asset of toDelete) {
        const params = deleteParamsForAsset(asset)
        if (!params) {
          failed += 1
          continue
        }
        const res = await deleteNotificationBannerAsset(token, params)
        if (res.ok) {
          removed += 1
          removedIds.add(asset.id)
        } else {
          failed += 1
        }
      }

      if (removed > 0) {
        setAssets((prev) => prev.filter((a) => !removedIds.has(a.id)))
        if (pendingId && removedIds.has(pendingId)) setPendingId(null)
        if (selectedId && removedIds.has(selectedId)) onSelect(null)
        setDeleteIds((prev) => {
          const next = new Set(prev)
          for (const id of removedIds) next.delete(id)
          return next
        })
      }

      if (failed === 0 && removed > 0) {
        toast.success(removed === 1 ? 'Banner deleted.' : `${removed} banners deleted.`)
        if (removed === toDelete.length) exitDeleteMode()
      } else if (removed > 0) {
        toast.warning(`${removed} deleted, ${failed} could not be deleted.`)
      } else {
        toast.error('Could not delete selected banners.')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Choose banner image"
      size="xl"
      onClose={handleClose}
      closeOnBackdrop={!deleting}
      headerActions={
        canDelete ? (
          deleteMode ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={deleting || loading}
                onClick={exitDeleteMode}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deleteCount === 0 || deleting || loading}
                onClick={() => void onDeleteBulk()}
              >
                {deleting ? 'Deleting…' : `Delete (${deleteCount})`}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleting || loading}
              onClick={() => {
                setDeleteMode(true)
                setDeleteIds(new Set())
              }}
            >
              Delete
            </Button>
          )
        ) : null
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-left text-xs text-slate-500">
            {deleteMode ? (
              <span>
                {deleteCount
                  ? `${deleteCount} selected for deletion`
                  : 'Tap images to select, then Delete in the header.'}
              </span>
            ) : pendingAsset?.fileName ? (
              <span className="truncate" title={pendingAsset.fileName}>
                Selected: {pendingAsset.fileName}
              </span>
            ) : (
              <span>Click an image to select it, then use “Use selected”.</span>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {deleteMode ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={deleting || assets.length === 0}
                  onClick={selectAllOnPage}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={deleting || deleteCount === 0}
                  onClick={clearDeleteSelection}
                >
                  Clear
                </Button>
              </>
            ) : hasNext ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loading || deleting}
                onClick={() => void loadPage(page + 1, true)}
              >
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" disabled={deleting} onClick={handleClose}>
              Close
            </Button>
            {!deleteMode ? (
              <Button type="button" size="sm" disabled={!pendingAsset || deleting} onClick={applySelection}>
                Use selected
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        {deleteMode
          ? 'Select one or more banners to remove from the library.'
          : 'Pick a banner you uploaded before. Images must be at most 380 KB when uploading a new file.'}
      </p>
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {error}
        </p>
      ) : null}
      {loading && assets.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading banners…</p>
      ) : null}
      {!loading && !error && assets.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No uploaded banners yet. Upload one below instead.</p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {assets.map((asset) => {
          const pickForUse = !deleteMode && pendingId === asset.id
          const pickForDelete = deleteMode && deleteIds.has(asset.id)
          return (
            <li key={asset.id}>
              <button
                type="button"
                aria-pressed={pickForUse || pickForDelete}
                disabled={deleting}
                onClick={() => {
                  if (deleteMode) toggleDeleteId(asset.id)
                  else setPendingId(asset.id)
                }}
                onDoubleClick={
                  deleteMode
                    ? undefined
                    : () => {
                        setPendingId(asset.id)
                        onSelect(asset)
                        handleClose()
                      }
                }
                className={`group relative flex w-full flex-col overflow-hidden rounded-lg border-2 bg-white text-left transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60 ${
                  pickForDelete
                    ? 'border-rose-500 ring-2 ring-rose-200'
                    : pickForUse
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {pickForDelete ? (
                  <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow">
                    ✓
                  </span>
                ) : pickForUse ? (
                  <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow">
                    ✓
                  </span>
                ) : null}
                <div className="aspect-[16/10] w-full bg-slate-100">
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.fileName || 'Banner'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                {asset.fileName ? (
                  <span className="truncate px-2 py-1.5 text-xs text-slate-600" title={asset.fileName}>
                    {asset.fileName}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
