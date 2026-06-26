/** Keep teacher.classIds and class.teacherIds aligned when editing assignments. */

export function syncTeacherToClasses(prevClasses, teacherId, nextClassIds) {
  return prevClasses.map((c) => {
    const wants = nextClassIds.includes(c.id)
    const has = c.teacherIds.includes(teacherId)
    if (wants && !has) {
      return { ...c, teacherIds: [...c.teacherIds, teacherId] }
    }
    if (!wants && has) {
      return { ...c, teacherIds: c.teacherIds.filter((id) => id !== teacherId) }
    }
    return c
  })
}

export function syncClassToTeachers(prevTeachers, classId, nextTeacherIds) {
  return prevTeachers.map((t) => {
    const wants = nextTeacherIds.includes(t.id)
    const has = t.classIds.includes(classId)
    if (wants && !has) {
      return { ...t, classIds: [...t.classIds, classId] }
    }
    if (!wants && has) {
      return { ...t, classIds: t.classIds.filter((id) => id !== classId) }
    }
    return t
  })
}
