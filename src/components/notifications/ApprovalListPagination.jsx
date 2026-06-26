import { ListPagination } from '../ui/ListPagination'

/**
 * Paginated approval queues — uses shared ListPagination styling.
 */
export function ApprovalListPagination({
  page,
  total,
  limit,
  hasNext,
  loading,
  onPrev,
  onNext,
  emptyLabel = 'No pending items on this page',
  className = 'mt-4',
}) {
  return (
    <ListPagination
      className={className}
      page={page}
      total={total}
      pageSize={limit}
      hasNext={hasNext}
      loading={loading}
      onPrev={onPrev}
      onNext={onNext}
      emptyLabel={emptyLabel}
    />
  )
}
