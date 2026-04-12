import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { ClientTable } from '@/components/clients/ClientTable'
import api from '@/lib/api'
import type { ApiResponse, PageResponse, ClientSummary } from '@/lib/types'

export default function ClientsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, size: 20, search: debouncedSearch }],
    queryFn: () =>
      api.get<ApiResponse<PageResponse<ClientSummary>>>('/clients', {
        params: { page, size: 20, search: debouncedSearch || undefined, sort: 'name,asc' },
      }).then((res) => res.data.data!),
    retry: false,
    placeholderData: (prev) => prev,
  })

  return (
    <AppShell>
      <Head><title>Clients — Billon</title></Head>
      <div className="max-w-4xl">
        <PageHeader
          title="Clients"
          action={
            <Link
              href="/clients/new"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
            >
              + New Client
            </Link>
          }
        />

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full max-w-xs border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <ClientTable clients={data?.content} isLoading={isLoading} />
        </div>

        <Pagination
          page={page}
          totalPages={data?.totalPages ?? 0}
          onPageChange={setPage}
        />
      </div>
    </AppShell>
  )
}
