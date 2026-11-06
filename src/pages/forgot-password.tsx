import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import api from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Forgot password — Billon</title></Head>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <div className="mb-6 text-center">
            <span className="text-2xl font-bold text-indigo-700">Billon</span>
            <p className="text-sm text-slate-500 mt-1">Reset your password</p>
          </div>
          {sent ? (
            <p className="text-sm text-slate-600">
              If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to reset your password.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md transition-colors"
              >
                {loading ? 'Sending…' : 'Send reset link'}
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
