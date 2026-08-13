import { Loader2 } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useSession } from '@/hooks/useSession'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { CalendarApp } from '@/components/calendar/CalendarApp'

export default function App() {
  const { authenticated, checking, login, logout } = useSession()

  return (
    <TooltipProvider delayDuration={200}>
      {checking ? (
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : authenticated ? (
        <CalendarApp onLogout={logout} />
      ) : (
        <LoginScreen onLogin={login} />
      )}
      <Toaster position="top-center" richColors closeButton />
    </TooltipProvider>
  )
}
