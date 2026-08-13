import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

export function useSession() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api
      .session()
      .then((res) => setAuthenticated(res.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (password: string) => {
    const res = await api.login(password)
    setAuthenticated(res.authenticated)
    return res.authenticated
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setAuthenticated(false)
  }, [])

  return { authenticated, checking, login, logout }
}
