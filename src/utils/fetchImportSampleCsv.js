/**
 * GET …/import/sample.csv — Bearer; saves as .csv even when the host sends text/plain.
 * @param {string} token
 * @param {{ url: string, defaultFilename: string, formatError: (data: unknown, status: number) => string }} opts
 * @returns {Promise<{ ok: true, blob: Blob, filename: string } | { ok: false, error: string }>}
 */
export async function fetchImportSampleCsv(token, { url, defaultFilename, formatError }) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/csv,application/octet-stream,*/*',
      },
    })
    const ctype = (res.headers.get('Content-Type') || '').toLowerCase()
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return { ok: false, error: formatError(data, res.status) }
    }
    if (ctype.includes('application/json')) {
      const data = await res.json().catch(() => null)
      return {
        ok: false,
        error: formatError(data, res.status) || 'Unexpected response',
      }
    }
    const blob = await res.blob()
    let filename = defaultFilename
    const cd = res.headers.get('Content-Disposition')
    if (cd) {
      const star = cd.match(/filename\*=UTF-8''([^;\s]+)/i)
      const quoted = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;\s]+)/i)
      if (star) {
        try {
          filename = decodeURIComponent(star[1])
        } catch {
          filename = star[1]
        }
      } else if (quoted) {
        filename = quoted[1].replace(/["']/g, '')
      }
    }
    const fallbackBase = defaultFilename.replace(/\.csv$/i, '') || 'import-sample'
    if (!/\.csv$/i.test(filename)) {
      filename = `${filename.replace(/\.(txt|text)$/i, '') || fallbackBase}.csv`
    }
    const csvBlob =
      ctype.includes('text/csv') || blob.type.includes('csv')
        ? blob
        : new Blob([await blob.arrayBuffer()], { type: 'text/csv;charset=utf-8' })
    return { ok: true, blob: csvBlob, filename }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}
