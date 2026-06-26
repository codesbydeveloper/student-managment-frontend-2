import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import {
  changeMyPassword,
  deleteMyProfilePhoto,
  updateMyDisplayName,
  uploadMyProfilePhoto,
} from '../api/profileApi'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Label, RequiredMark } from '../components/ui/Label'
import { RoleBadge } from '../components/ui/Badge'
import { UserProfileAvatar } from '../components/profile/UserProfileAvatar'
import { ProfilePhotoPreviewModal } from '../components/profile/ProfilePhotoPreviewModal'
import { useProfilePrefs } from '../hooks/useProfilePrefs'
import { required, minLength } from '../utils/validators'
import { ROLE_LABELS } from '../utils/constants'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export default function ProfilePage() {
  const { user, token } = useAuth()
  const fileRef = useRef(null)
  const {
    displayName,
    profileImage,
    loading,
    refresh,
    applyApiProfile,
  } = useProfilePrefs(user?.id, user?.fullName, token)

  const [displayNameInput, setDisplayNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})
  const [savingPassword, setSavingPassword] = useState(false)
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false)

  useEffect(() => {
    setDisplayNameInput(displayName)
  }, [displayName])

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error('Use PNG, JPG, or WEBP.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Image is too large (max 2 MB).')
      return
    }
    setUploadingPhoto(true)
    const res = await uploadMyProfilePhoto(token, file)
    setUploadingPhoto(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not upload photo.')
      return
    }
    if (res.profile) applyApiProfile(res.profile)
    else await refresh()
    toast.success('Profile photo updated.')
  }

  const onRemovePhoto = async () => {
    setUploadingPhoto(true)
    const res = await deleteMyProfilePhoto(token)
    setUploadingPhoto(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not remove photo.')
      return
    }
    if (res.profile) applyApiProfile(res.profile)
    else await refresh()
    if (fileRef.current) fileRef.current.value = ''
    toast.info('Profile photo removed.')
  }

  const onSaveDisplayName = async () => {
    const name = displayNameInput.trim()
    const err = required(name, 'Display name')
    if (err) {
      toast.error(err)
      return
    }
    setSavingName(true)
    const res = await updateMyDisplayName(token, name)
    setSavingName(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not save display name.')
      return
    }
    if (res.profile) applyApiProfile(res.profile)
    else await refresh()
    toast.success('Display name saved.')
  }

  const onChangePassword = async (e) => {
    e.preventDefault()
    const eCur = required(currentPassword, 'Current password')
    const eNew =
      required(newPassword, 'New password') || minLength(newPassword, 6, 'New password')
    const eConfirm =
      required(confirmPassword, 'Confirm password') ||
      (newPassword !== confirmPassword ? 'Passwords do not match' : '')
    const next = {
      currentPassword: eCur,
      newPassword: eNew,
      confirmPassword: eConfirm,
    }
    setPasswordErrors(next)
    if (eCur || eNew || eConfirm) return

    setSavingPassword(true)
    const res = await changeMyPassword(token, currentPassword, newPassword, confirmPassword)
    setSavingPassword(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not update password.')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordErrors({})
    toast.success('Password updated.')
  }

  if (!user) return null

  const email = user.email || '—'
  const roleLabel = ROLE_LABELS[user.role] || user.role

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-slate-600">Photo, display name, and password in one place.</p>
        </div>
        <Link to="/dashboard">
          <Button type="button" variant="secondary" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="-mx-4 -my-4 flex flex-col sm:-mx-6 sm:-my-6 lg:flex-row lg:items-stretch">
          <div className="flex shrink-0 flex-col items-center gap-3 border-b border-slate-200/90 bg-gradient-to-br from-indigo-50/80 to-violet-50/50 px-6 py-8 lg:w-56 lg:border-b-0 lg:border-r">
            <UserProfileAvatar
              displayName={displayName}
              profileImage={profileImage}
              size="lg"
              linkToProfile={false}
              onPhotoClick={profileImage ? () => setPhotoPreviewOpen(true) : undefined}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void onPickPhoto(e)}
              disabled={uploadingPhoto || loading}
            />
            <div className="flex w-full max-w-[12rem] flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={uploadingPhoto || loading}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingPhoto ? 'Uploading…' : 'Change photo'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => void onRemovePhoto()}
                disabled={!profileImage || uploadingPhoto || loading}
              >
                Remove
              </Button>
            </div>
          </div>

          <div className="min-w-0 flex-1 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {loading ? '…' : displayName}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">{email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RoleBadge role={user.role} />
                  <span className="text-xs font-medium text-slate-500">{roleLabel}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Display name
                <RequiredMark />
              </p>
              <p className="mt-1 text-sm text-slate-600">Shown in the header and across the app.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <Label htmlFor="profile-display-name" className="sr-only">
                    Display name
                  </Label>
                  <Input
                    id="profile-display-name"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Your display name"
                    disabled={loading}
                  />
                </div>
                <Button
                  type="button"
                  disabled={savingName || loading}
                  className="shrink-0 sm:min-w-[9rem]"
                  onClick={() => void onSaveDisplayName()}
                >
                  {savingName ? 'Saving…' : 'Save name'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Reset password</h2>
            <p className="mt-0.5 text-sm text-slate-600">Use your current password, then set a new one.</p>
          </div>
        </div>

        <form className="mt-6" onSubmit={(e) => void onChangePassword(e)}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="profile-current-password" required>Current password</Label>
              <PasswordInput
                id="profile-current-password"
                className="mt-1.5"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              {passwordErrors.currentPassword ? (
                <p className="mt-1 text-xs text-rose-600">{passwordErrors.currentPassword}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="profile-new-password" required>New password</Label>
              <PasswordInput
                id="profile-new-password"
                className="mt-1.5"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {passwordErrors.newPassword ? (
                <p className="mt-1 text-xs text-rose-600">{passwordErrors.newPassword}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="profile-confirm-password" required>Confirm password</Label>
              <PasswordInput
                id="profile-confirm-password"
                className="mt-1.5"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordErrors.confirmPassword ? (
                <p className="mt-1 text-xs text-rose-600">{passwordErrors.confirmPassword}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={savingPassword} className="min-w-[10rem]">
              {savingPassword ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      </Card>

      <ProfilePhotoPreviewModal
        open={photoPreviewOpen}
        onClose={() => setPhotoPreviewOpen(false)}
        imageUrl={profileImage}
        displayName={displayName}
      />
    </div>
  )
}
