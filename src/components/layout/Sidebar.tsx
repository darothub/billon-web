import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  HomeIcon,
  UserGroupIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: HomeIcon },
  { label: 'Clients', href: '/clients', icon: UserGroupIcon },
  { label: 'Invoices', href: '/invoices', icon: DocumentTextIcon },
]

const BOTTOM_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

interface SidebarProps {
  mobileOpen: boolean
}

export function Sidebar({ mobileOpen }: SidebarProps) {
  const router = useRouter()

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/'
    return router.pathname.startsWith(href)
  }

  const NavItem = ({ label, href, icon: Icon }: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }) => (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
        isActive(href)
          ? 'bg-indigo-50 text-indigo-700 font-medium'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-[180px] bg-slate-50 border-r border-slate-200 h-screen sticky top-0 shrink-0">
        <div className="px-3 py-4 border-b border-slate-200">
          <span className="text-base font-bold text-indigo-700">Billon</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-slate-200 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <aside className="flex flex-col w-[180px] bg-slate-50 border-r border-slate-200 h-full shrink-0">
            <div className="px-3 py-4 border-b border-slate-200">
              <span className="text-base font-bold text-indigo-700">Billon</span>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </nav>
            <div className="px-2 py-3 border-t border-slate-200 space-y-0.5">
              {BOTTOM_ITEMS.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </aside>
          <div className="flex-1 bg-black/40" />
        </div>
      )}
    </>
  )
}
