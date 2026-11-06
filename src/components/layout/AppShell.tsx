import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { token, logout } = useAuthStore()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!token || Cookies.get('billon_token') !== token) {
      logout()
      router.replace('/login')
      return
    }
    let active = true
    setSessionChecked(false)
    api.get('/users/me')
      .then(() => { if (active) setSessionChecked(true) })
      .catch(() => undefined)
    return () => { active = false }
  }, [mounted, token, logout, router])

  if (!mounted || !token || !sessionChecked) return null

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar mobileOpen={mobileOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
