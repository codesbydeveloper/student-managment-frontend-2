import { useState } from 'react'
import { TbCheck, TbCopy } from 'react-icons/tb'
import { Modal } from '../Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { StatusBadge } from '../notifications/StatusBadge'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_STATUSES,
} from '../../utils/notificationConstants'
import {
  formatNotificationApprovalAttribution,
  isApprovedNoticeStatus,
} from '../../api/notificationsApi'
import { formatNotificationDateOnly } from '../../utils/notificationFormat'
import { AudienceForSection } from './AudienceForSection'

const categoryBadge = {
  [NOTIFICATION_CATEGORIES.ADMINISTRATIVE]:
    'bg-sky-50 text-sky-900 ring-sky-300/40 shadow-sm shadow-sky-900/[0.04]',
  [NOTIFICATION_CATEGORIES.ACADEMIC]:
    'bg-emerald-50 text-emerald-900 ring-emerald-300/40 shadow-sm shadow-emerald-900/[0.04]',
}

function splitLines(text) {
  return String(text || '')
    .replace(/^[\s"']+|[\s"']+$/g, '')
    .split(/\r?\n|\\n/)
    .map((s) => s.trim().replace(/^["']+|["']+$/g, ''))
    .filter(Boolean)
}

/** `Label|https://…` or plain URL */
function parseLinkLine(line) {
  const s = String(line).trim()
  const pipe = s.indexOf('|')
  if (pipe > 0) {
    const label = s.slice(0, pipe).trim()
    const href = s.slice(pipe + 1).trim()
    return { label: label || href, href }
  }
  return { label: s, href: s }
}

function normalizeHttpUrl(s) {
  const raw = String(s || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

function rejectionDisplayText(item) {
  const reason = String(item?.rejectionReason ?? '').trim()
  const message = String(item?.rejectedMessage ?? '').trim()
  if (reason && message && reason !== message) {
    return `${reason}\n\n${message}`
  }
  return reason || message
}

function CopyLinkButton({ href }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const value = String(href || '').trim()
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      title={copied ? 'Copied' : 'Copy link'}
      aria-label={copied ? 'Copied' : 'Copy link'}
      onClick={(e) => void onCopy(e)}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {copied ? (
        <TbCheck className="size-3.5 text-emerald-600" aria-hidden />
      ) : (
        <TbCopy className="size-3.5" aria-hidden />
      )}
    </button>
  )
}

function LineList({ label, lines }) {
  if (!lines.length) return null
  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line, i) => {
          const { label: linkLabel, href: rawHref } = parseLinkLine(line)
          const href = normalizeHttpUrl(rawHref || linkLabel)
          const copyValue = String(rawHref || linkLabel || '').trim() || href
          if (!href) {
            return (
              <li key={`${i}-${line}`} className="text-sm text-slate-600">
                {line}
              </li>
            )
          }
          return (
            <li key={`${i}-${href}`} className="flex items-start gap-1.5 text-sm">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 break-all font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-900"
              >
                {linkLabel || href}
              </a>
              <CopyLinkButton href={copyValue} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Full message from GET /api/parents/messages/:id (mapped feed item).
 */
export function ParentMessageDetailModal({
  open,
  onClose,
  loading,
  error,
  item,
  modalTitle = 'School message',
}) {
  const showBody = !loading && !error && item
  const videoLines = showBody && item.videoUrls ? splitLines(item.videoUrls) : []
  const externalLines = showBody && item.externalLinks ? splitLines(item.externalLinks) : []
  const rejectionText = showBody ? rejectionDisplayText(item) : ''
  const approvedBy = showBody ? formatNotificationApprovalAttribution(item) : null
  const showApproval = showBody && isApprovedNoticeStatus(item.status) && Boolean(approvedBy)
  const showRejection =
    showBody &&
    (item.status === NOTIFICATION_STATUSES.REJECTED || Boolean(rejectionText || item.rejectedAt))
  const receivedDate = showBody
    ? formatNotificationDateOnly(
        item.receivedAt ?? item.submittedAt ?? item.approvedAt ?? item.updatedAt ?? '',
      )
    : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-600">Loading message…</p>
      ) : null}
      {error && !loading ? (
        <p className="text-sm font-medium text-red-800">{error}</p>
      ) : null}
      {showBody ? (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="min-w-0 flex-1 text-base font-bold text-slate-900 sm:text-lg">
              {item.title}
            </h4>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {receivedDate ? (
                <p className="text-xs font-medium tabular-nums text-slate-600">
                  <span className="font-semibold text-slate-500">Date</span>{' '}
                  <span className="text-slate-800">{receivedDate}</span>
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    categoryBadge[item.category] || 'bg-slate-50 text-slate-800 ring-slate-200/60'
                  }
                >
                  {NOTIFICATION_CATEGORY_LABELS[item.category] || item.category}
                </Badge>
                {item.status ? (
                  <StatusBadge status={item.status} variant="inline" />
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-600/25">Approved</Badge>
                )}
              </div>
            </div>
          </div>

          {showRejection ? (
            <div
              className="rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-red-950"
              role="status"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                Rejection reason
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                {rejectionText || 'No reason was provided.'}
              </p>
              {item.rejectedAt ? (
                <p className="mt-2 text-xs text-red-800/80">Rejected {item.rejectedAt}</p>
              ) : null}
            </div>
          ) : null}

          {item.bannerDisplayUrl ? (
            <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50">
              <img
                src={item.bannerDisplayUrl}
                alt=""
                className="max-h-44 w-full object-contain sm:max-h-52"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">
              {item.message?.trim() ? item.message : '—'}
            </p>
          </div>

          <LineList label="Videos" lines={videoLines} />
          <LineList label="External links" lines={externalLines} />

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p>
            <p className="mt-1 font-medium text-slate-900">
              {item.sender?.fullName ||
                (item.createdByName && item.createdByName !== '—' ? item.createdByName : null) ||
                '—'}
            </p>
            {item.sender?.email && item.sender.email !== item.sender.fullName ? (
              <p className="mt-0.5 text-xs text-slate-500">{item.sender.email}</p>
            ) : null}
          </div>

          {showApproval ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Approved by
              </p>
              <p className="mt-1 font-medium text-indigo-900">{approvedBy}</p>
            </div>
          ) : null}

          <AudienceForSection labels={item._feedChildNames} label={item._feedChildNamesLabel} />
        </div>
      ) : null}
    </Modal>
  )
}
