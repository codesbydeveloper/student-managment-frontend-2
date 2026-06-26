import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { fetchClassesAssigned } from '../../api/classesApi'
import { fetchSchoolDirectoryNoticeTargets } from '../../api/schoolDirectoryApi'
import {
  fetchNoticeCategoriesByCategoryKind,
  postNotificationCreate,
} from '../../api/notificationsApi'
import { BannerAssetPicker } from './BannerAssetPicker'
import { fetchAllStudentsAssignedMinimal } from '../../api/studentsApi'
import { ROLES } from '../../utils/constants'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select } from '../ui/Select'
import { TargetSelector } from './TargetSelector'
import {
  NOTIFICATION_BANNER_MAX_BYTES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_TARGET_TYPES,
} from '../../utils/notificationConstants'

/**
 * Full “create notice” layout. Sub-categories load from GET …/notice-categories/{administrative|academic}.
 */
export function CreateNoticeForm() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const { classes, students } = useAppData()
  const useSchoolDirectory =
    user?.role === ROLES.ADMIN || user?.role === ROLES.PRINCIPAL
  const canManageBannerLibrary =
    user?.role === ROLES.ADMIN || user?.role === ROLES.PRINCIPAL
  const [summaryClasses, setSummaryClasses] = useState(undefined)
  const [directoryBundle, setDirectoryBundle] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadSummary() {
      if (!token || useSchoolDirectory) {
        setSummaryClasses(undefined)
        return
      }
      const res = await fetchClassesAssigned(token)
      if (cancelled) return
      if (res.ok) {
        setSummaryClasses(res.classes)
      } else {
        setSummaryClasses(undefined)
      }
    }
    void loadSummary()
    return () => {
      cancelled = true
    }
  }, [token, useSchoolDirectory])

  useEffect(() => {
    if (!token || !useSchoolDirectory) {
      setDirectoryBundle(null)
      return
    }
    let cancelled = false
    setDirectoryBundle({ loading: true, error: null, classes: [], sectionRows: [], students: [] })
    ;(async () => {
      const res = await fetchSchoolDirectoryNoticeTargets(token)
      if (cancelled) return
      if (!res.ok) {
        setDirectoryBundle({
          loading: false,
          error: res.error || 'Could not load school directory.',
          classes: [],
          sectionRows: [],
          students: [],
        })
        toast.error(res.error || 'Could not load school directory for targeting.')
        return
      }
      setDirectoryBundle({
        loading: false,
        error: null,
        classes: res.classes,
        sectionRows: res.sectionRows,
        students: res.students,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [token, useSchoolDirectory])

  const legacyClasses = summaryClasses !== undefined ? summaryClasses : classes
  const directoryReady =
    useSchoolDirectory && directoryBundle && !directoryBundle.loading && !directoryBundle.error
  const classPickerClasses =
    directoryReady && directoryBundle.classes.length > 0 ? directoryBundle.classes : legacyClasses
  const sectionPickerClasses =
    directoryReady && directoryBundle.sectionRows.length > 0
      ? directoryBundle.sectionRows
      : legacyClasses
  const directoryTargetsLoading = Boolean(useSchoolDirectory && directoryBundle?.loading)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState(NOTIFICATION_CATEGORIES.ADMINISTRATIVE)
  const [subCategoryId, setSubCategoryId] = useState('')
  const [subCategories, setSubCategories] = useState([])
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(false)
  const [subCategoriesError, setSubCategoriesError] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState(null)
  const [selectedBannerAsset, setSelectedBannerAsset] = useState(null)
  const [bannerLibraryOpen, setBannerLibraryOpen] = useState(false)
  const [videoUrlsText, setVideoUrlsText] = useState('')
  const [externalLinksText, setExternalLinksText] = useState('')
  const [targetType, setTargetType] = useState(NOTIFICATION_TARGET_TYPES.CLASS)
  const [targetIds, setTargetIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [studentTargetsLoading, setStudentTargetsLoading] = useState(false)
  const [studentTargetsFromApi, setStudentTargetsFromApi] = useState(null)

  useEffect(() => {
    if (useSchoolDirectory) {
      setStudentTargetsFromApi(null)
      setStudentTargetsLoading(false)
      return
    }
    if (targetType !== NOTIFICATION_TARGET_TYPES.STUDENT) {
      setStudentTargetsFromApi(null)
      setStudentTargetsLoading(false)
      return
    }
    if (!token) {
      setStudentTargetsFromApi(null)
      setStudentTargetsLoading(false)
      return
    }
    let cancelled = false
    setStudentTargetsLoading(true)
    setStudentTargetsFromApi(null)
    ;(async () => {
      const res = await fetchAllStudentsAssignedMinimal(token)
      if (cancelled) return
      setStudentTargetsLoading(false)
      if (res.ok) {
        setStudentTargetsFromApi(res.students)
      } else {
        setStudentTargetsFromApi([])
        toast.error(res.error || 'Could not load students for targeting.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [targetType, token, useSchoolDirectory])

  useEffect(() => {
    setSubCategoryId('')
    if (!token) {
      setSubCategories([])
      setSubCategoriesLoading(false)
      setSubCategoriesError(null)
      return
    }
    let cancelled = false
    setSubCategoriesLoading(true)
    setSubCategoriesError(null)
    setSubCategories([])
    ;(async () => {
      try {
        const accumulated = []
        let page = 1
        const limit = 50
        for (;;) {
          const res = await fetchNoticeCategoriesByCategoryKind(token, category, { page, limit })
          if (cancelled) return
          if (!res.ok) {
            setSubCategoriesLoading(false)
            setSubCategories([])
            if (res.httpStatus === 403) {
              setSubCategoriesError(
                category === NOTIFICATION_CATEGORIES.ADMINISTRATIVE
                  ? 'Administrative sub-categories are only available to administrators.'
                  : 'Academic sub-categories are only available to the principal.',
              )
            } else {
              const msg = res.error || 'Could not load sub-categories.'
              setSubCategoriesError(msg)
              toast.error(msg)
            }
            return
          }
          accumulated.push(...res.categories)
          if (!res.hasNext || !res.categories.length) break
          page += 1
          if (page > 40) break
        }
        if (cancelled) return
        setSubCategoriesLoading(false)
        setSubCategoriesError(null)
        setSubCategories(accumulated)
      } finally {
        if (cancelled) {
          setSubCategoriesLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [category, token])

  useEffect(() => {
    return () => {
      if (bannerPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(bannerPreviewUrl)
    }
  }, [bannerPreviewUrl])

  const studentsForTargets =
    useSchoolDirectory && directoryReady
      ? directoryBundle.students
      : targetType === NOTIFICATION_TARGET_TYPES.STUDENT && token
        ? studentTargetsFromApi ?? []
        : students

  const onBannerFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Choose an image file (PNG, JPG, …).')
      return
    }
    if (file.size > NOTIFICATION_BANNER_MAX_BYTES) {
      toast.error('Banner image must be at most 380 KB.')
      return
    }
    setSelectedBannerAsset(null)
    setBannerFile(file)
    setBannerPreviewUrl(URL.createObjectURL(file))
  }

  const onSelectBannerAsset = (asset) => {
    setBannerFile(null)
    setSelectedBannerAsset(asset)
    setBannerPreviewUrl(asset.url)
  }

  const clearBanner = () => {
    setBannerFile(null)
    setSelectedBannerAsset(null)
    setBannerPreviewUrl(null)
  }

  const invalid = useMemo(() => {
    return !title.trim() || !message.trim() || !targetIds.length
  }, [title, message, targetIds])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (invalid) {
      toast.error('Fill in title, message, and at least one target.')
      return
    }
    if (!token) {
      toast.error('Sign in to create a notice.')
      return
    }
    setSubmitting(true)
    try {
      const apiRes = await postNotificationCreate(token, {
        title,
        message,
        category,
        targetType,
        targetIds,
        subCategoryId: subCategoryId || undefined,
        videoUrlsText,
        externalLinksText,
        bannerFile,
        bannerImageUrl: selectedBannerAsset?.url,
        bannerAssetId: selectedBannerAsset?.id,
      })
      if (apiRes.ok) {
        const msg =
          (apiRes.data && typeof apiRes.data.message === 'string' && apiRes.data.message) ||
          'Notice created.'
        toast.success(msg)
        navigate('/notifications')
        return
      }
      toast.error(apiRes.error || 'Could not create notice.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div>
        <Label htmlFor="cn-title" required>Title</Label>
        <Input
          id="cn-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short headline"
        />
      </div>
      <div>
        <Label htmlFor="cn-message" required>Message</Label>
        <textarea
          id="cn-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="What should families or staff know?"
          className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cn-category">Category</Label>
          <Select id="cn-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value={NOTIFICATION_CATEGORIES.ADMINISTRATIVE}>
              {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE]}
            </option>
            <option value={NOTIFICATION_CATEGORIES.ACADEMIC}>
              {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC]}
            </option>
          </Select>
        </div>
        <div>
          <Label htmlFor="cn-subcategory">Sub-category</Label>
          <Select
            id="cn-subcategory"
            value={subCategoryId}
            onChange={(e) => setSubCategoryId(e.target.value)}
            disabled={subCategoriesLoading}
          >
            <option value="">None</option>
            {subCategories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.displayName}
              </option>
            ))}
          </Select>
          {subCategoriesLoading ? (
            <p className="mt-1.5 text-xs text-slate-500">Loading sub-categories…</p>
          ) : subCategoriesError ? (
            <p className="mt-1.5 text-xs text-amber-800">{subCategoriesError}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
        <p className="text-sm font-semibold text-slate-800">Banner & links (optional)</p>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="cn-banner-file" className="text-sm text-slate-800">
              Banner image (optional, max 380 KB)
            </Label>
            <p className="mt-1 text-xs text-slate-500">
              Upload a new image or choose one you used on a previous notice.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!token}
                onClick={() => setBannerLibraryOpen(true)}
              >
                Choose from library
              </Button>
            </div>
            <input
              id="cn-banner-file"
              type="file"
              accept="image/*"
              className="sm-file-input mt-2 block w-full"
              onChange={onBannerFile}
            />
            {bannerPreviewUrl ? (
              <div className="mt-2 space-y-2">
                <img
                  src={bannerPreviewUrl}
                  alt="Banner preview"
                  className="max-h-40 max-w-full rounded-lg border border-slate-200 object-contain"
                />
                {selectedBannerAsset?.fileName ? (
                  <p className="text-xs text-slate-500">From library: {selectedBannerAsset.fileName}</p>
                ) : null}
                <Button type="button" variant="secondary" size="sm" onClick={clearBanner}>
                  Clear banner
                </Button>
              </div>
            ) : null}
          </div>
          <BannerAssetPicker
            token={token}
            open={bannerLibraryOpen}
            selectedId={selectedBannerAsset?.id}
            canDelete={canManageBannerLibrary}
            onClose={() => setBannerLibraryOpen(false)}
            onSelect={(asset) => {
              if (!asset) {
                clearBanner()
                return
              }
              onSelectBannerAsset(asset)
            }}
          />
          <div>
            <Label htmlFor="cn-videos">Video URLs (one per line)</Label>
            <textarea
              id="cn-videos"
              value={videoUrlsText}
              onChange={(e) => setVideoUrlsText(e.target.value)}
              rows={3}
              placeholder="https://www.youtube.com/watch?v=…"
              className="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>
          <div>
            <Label htmlFor="cn-ext">External links (one per line)</Label>
            <textarea
              id="cn-ext"
              value={externalLinksText}
              onChange={(e) => setExternalLinksText(e.target.value)}
              rows={3}
              placeholder={'https://example.com/form\nHandbook PDF|https://school.edu/handbook.pdf'}
              className="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cn-target-type" required>Target type</Label>
          <Select
            id="cn-target-type"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value)
              setTargetIds([])
            }}
          >
            <option value={NOTIFICATION_TARGET_TYPES.CLASS}>Class</option>
            <option value={NOTIFICATION_TARGET_TYPES.SECTION}>Section</option>
            <option value={NOTIFICATION_TARGET_TYPES.STUDENT}>Student</option>
          </Select>
        </div>
      </div>

      {directoryTargetsLoading ? (
        <p className="text-sm text-slate-500">Loading classes, sections, and students from school directory…</p>
      ) : null}
      {targetType === NOTIFICATION_TARGET_TYPES.STUDENT &&
      token &&
      !useSchoolDirectory &&
      studentTargetsLoading ? (
        <p className="text-sm text-slate-500">Loading students…</p>
      ) : null}
      <TargetSelector
        targetType={targetType}
        value={targetIds}
        onChange={setTargetIds}
        disabled={
          submitting ||
          directoryTargetsLoading ||
          (targetType === NOTIFICATION_TARGET_TYPES.STUDENT &&
            token &&
            !useSchoolDirectory &&
            studentTargetsLoading)
        }
        classes={
          targetType === NOTIFICATION_TARGET_TYPES.SECTION ? sectionPickerClasses : classPickerClasses
        }
        students={studentsForTargets}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={invalid || submitting || !token}>
          {submitting ? 'Creating…' : 'Create notice'}
        </Button>
      </div>
    </form>
  )
}
