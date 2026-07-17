import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Compass className="h-8 w-8 text-muted-foreground" />
      <div className="text-sm font-medium">Page not found</div>
      <p className="max-w-sm text-xs text-muted-foreground">
        The page you are looking for does not exist. Use the navigation or the command palette
        (Ctrl+K) to get back on track.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-1')}>
        Go to Dashboard
      </Link>
    </div>
  )
}
