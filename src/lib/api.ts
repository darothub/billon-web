import axios from 'axios'
import Cookies from 'js-cookie'
import { useAuthStore } from './auth'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('billon_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('billon_token')
      useAuthStore.getState().logout()
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)

export default api
