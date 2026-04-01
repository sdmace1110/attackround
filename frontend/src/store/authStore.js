import { create } from 'zustand'
import api from '../services/api'

const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  user: null,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    set({ token: data.access_token })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },
}))

export default useAuthStore