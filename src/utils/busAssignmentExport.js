function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * @param {Array<{ busName: string, plate: string, driverName: string, studentName: string, studentEmail?: string, studentClass?: string, note?: string }>} rows
 * @param {string} filename
 */
export function downloadBusAssignmentsCsv(rows, filename) {
  const header = [
    'Bus name',
    'Number plate',
    'Driver name',
    'Student name',
    'Student email',
    'Class',
    'Note',
  ]
  const lines = rows.map((r) =>
    [
      r.busName,
      r.plate,
      r.driverName,
      r.studentName,
      r.studentEmail ?? '',
      r.studentClass ?? '',
      r.note ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function busExportFilename({ singleBus, busName }) {
  const stamp = new Date().toISOString().slice(0, 10)
  if (singleBus && busName) {
    const safe = String(busName)
      .replace(/[^\w\s-]/g, '')
      .trim()
      .slice(0, 40)
      .replace(/\s+/g, '-')
    return `bus-students-${safe || 'bus'}-${stamp}.csv`
  }
  return `all-bus-students-${stamp}.csv`
}
