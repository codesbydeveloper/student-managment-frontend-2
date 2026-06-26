import { ROLES } from './constants'
import { hasMenuScreenAccess, isMenuAccessRole } from './permissions'

export function filterStudentsForUser(user, students, teachers, parents) {
  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.PRINCIPAL ||
    (isMenuAccessRole(user.role) && hasMenuScreenAccess(user.menuAccess, 'students'))
  ) {
    return students
  }
  if (user.role === ROLES.TEACHER) {
    const profile = teachers.find((t) => t.email.toLowerCase() === user.email.toLowerCase())
    if (!profile?.classIds?.length) return students
    return students.filter((s) => profile.classIds.includes(s.classId))
  }
  if (user.role === ROLES.PARENT) {
    const guardian = parents.find((p) => p.email.toLowerCase() === user.email.toLowerCase())
    if (!guardian) return []
    return students.filter((s) => guardian.studentIds.includes(s.id))
  }
  return []
}

/** Full teacher directory for every role; TeachersModule still gates edit/delete with {@link canManageTeachers}. */
export function filterTeachersForUser(_user, teachers) {
  if (!Array.isArray(teachers)) return []
  return teachers
}
