import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { NotificationForm } from '../components/notifications/NotificationForm'

export default function NotificationCreatePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/notifications">
          <Button type="button" variant="secondary" size="sm">
            Back to list
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader
          title="Create notification"
          subtitle="Compose a school-wide message. It will enter the approval queue based on category."
        />
        <NotificationForm />
      </Card>
    </div>
  )
}
