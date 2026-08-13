import { CheckCircle2, LogOut, Unlink } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/colors'
import { api } from '@/lib/api'
import type { Account } from '@/types'

export function SettingsSheet({
  open,
  onOpenChange,
  accounts,
  googleConfigured,
  onDisconnect,
  onLogout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  googleConfigured: boolean
  onDisconnect: (slot: 'a' | 'b') => Promise<void>
  onLogout: () => Promise<void>
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Connect each of your Google Calendars to sync events.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4">
          {!googleConfigured ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Google OAuth isn&apos;t configured on the server yet. Add{' '}
              <code className="text-xs">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="text-xs">GOOGLE_CLIENT_SECRET</code> to the server environment.
            </p>
          ) : null}

          {accounts.map((account) => {
            const colors = colorClasses[account.color]
            return (
              <div
                key={account.slot}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <span className={cn('size-3 shrink-0 rounded-full', colors.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.connected ? account.email : 'Not connected'}
                  </p>
                </div>
                {account.connected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-shared" aria-hidden="true" />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Disconnect ${account.name}`}
                      onClick={() => onDisconnect(account.slot)}
                    >
                      <Unlink className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button asChild size="sm" disabled={!googleConfigured}>
                    <a href={api.connectUrl(account.slot)}>Connect</a>
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2 px-4 pb-4">
          <Separator className="mb-2" />
          <Button type="button" variant="outline" onClick={onLogout}>
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
