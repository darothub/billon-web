import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/utils'

export default function ResetPasswordPage() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: password })
      setDone(true)
      setTimeout(() => router.replace('/login'), 2000)
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'We could not reset your password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Reset password — Billon</title></Head>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <div className="mb-6 text-center">
            <span className="text-2xl font-bold text-indigo-700">Billon</span>
            <p className="text-sm text-slate-500 mt-1">Choose a new password</p>
          </div>
          {router.isReady && !token ? (
            <p className="text-sm text-red-600">
              This reset link is invalid. <Link href="/forgot-password" className="text-indigo-600 hover:text-indigo-800">Request a new one</Link>.
            </p>
          ) : done ? (
            <p className="text-sm text-slate-600">Password updated. Redirecting to sign in…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md transition-colors"
              >
                {loading ? 'Updating…' : 'Reset password'}
              </button>
            </form>
          )}
          <p className="text-sm text-center text-slate-500 mt-4">
            <Link href="/login" className="text-indigo-600 hover:text-indigo-800">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
