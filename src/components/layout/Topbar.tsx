import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Bars3Icon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/auth'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiResponse, UserProfile } from '@/lib/types'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api.get<ApiResponse<UserProfile>>('/users/me').then((res) => res.data.data!),
    retry: false,
  })

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : '...'

  return (
    <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1 text-slate-500 hover:text-slate-700"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
        <span className="text-base font-bold text-indigo-700 lg:hidden">Billon</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900"
        >
          <span>{displayName}</span>
          <ChevronDownIcon className="w-4 h-4" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-slate-200 rounded-md shadow-md py-1">
              <Link
                href="/settings"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setDropdownOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
