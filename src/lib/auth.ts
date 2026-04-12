import { create } from 'zustand'
import Cookies from 'js-cookie'

interface AuthState {
  token: string | null
  setToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? Cookies.get('billon_token') ?? null : null,
  setToken: (token) => {
    Cookies.set('billon_token', token, { expires: 7, sameSite: 'lax' })
    set({ token })
  },
  logout: () => {
    Cookies.remove('billon_token')
    set({ token: null })
  },
}))
