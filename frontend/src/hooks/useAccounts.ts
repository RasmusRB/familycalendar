import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Account, PartnerSlot } from '@/types'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [googleConfigured, setGoogleConfigured] = useState(true)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.accounts()
      setAccounts(res.accounts)
      setGoogleConfigured(res.googleConfigured)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const disconnect = useCallback(
    async (slot: PartnerSlot) => {
      await api.disconnectAccount(slot)
      await refresh()
    },
    [refresh],
  )

  return { accounts, googleConfigured, loading, refresh, disconnect }
}
