import { useEffect, useState } from 'react'
import { fetchClassGrades, fetchClassSections } from '../api/classesApi'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/Button'
import { Select } from './ui/Select'

/**
 * Compact Grade + Section dropdowns for list toolbars.
 * Options come from GET /api/classes/grades and GET /api/classes/sections.
 */
export function GradeSectionFilters({
  grade = '',
  section = '',
  onGradeChange,
  onSectionChange,
  idPrefix = 'grade-section',
  className = '',
}) {
  const { token } = useAuth()
  const [grades, setGrades] = useState([])
  const [sections, setSections] = useState([])

  useEffect(() => {
    if (!token) {
      setGrades([])
      setSections([])
      return
    }
    let cancelled = false
    ;(async () => {
      const [gradesRes, sectionsRes] = await Promise.all([
        fetchClassGrades(token),
        fetchClassSections(token),
      ])
      if (cancelled) return
      if (gradesRes.ok) setGrades(gradesRes.grades)
      if (sectionsRes.ok) setSections(sectionsRes.sections)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const hasFilter = Boolean(grade || section)

  const clearBoth = () => {
    onGradeChange?.('')
    onSectionChange?.('')
  }

  return (
    <div className={`flex flex-nowrap items-center gap-2 ${className}`.trim()}>
      <div className="w-[8.5rem] shrink-0">
        <Select
          id={`${idPrefix}-grade`}
          aria-label="Filter by grade"
          value={grade}
          onChange={(e) => onGradeChange?.(e.target.value)}
        >
          <option value="">Grade</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[8.5rem] shrink-0">
        <Select
          id={`${idPrefix}-section`}
          aria-label="Filter by section"
          value={section}
          onChange={(e) => onSectionChange?.(e.target.value)}
        >
          <option value="">Section</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      {hasFilter ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={clearBoth}
        >
          Clear
        </Button>
      ) : null}
    </div>
  )
}
