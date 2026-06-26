import { Label } from '../ui/Label'
import { Select } from '../ui/Select'

/**
 * Filter parent notification feed by child or all children.
 */
export function ChildFilter({ value, onChange, childrenList }) {
  return (
    <div className="max-w-md">
      <Label htmlFor="parent-child-filter">Filter by child</Label>
      <Select
        id="parent-child-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      >
        <option value="all">All children</option>
        {childrenList.map((c) => (
          <option key={c.id} value={c.id}>
            {c.fullName}
          </option>
        ))}
      </Select>
    </div>
  )
}
