import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (userData, token) => set({
        user: userData,
        token,
        isAuthenticated: true,
      }),

      logout: () => {
        localStorage.removeItem('rsm-auth')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      updateUser: (userData) => set((state) => ({
        user: { ...state.user, ...userData },
      })),

      hasRole: (role) => {
        const { user } = get()
        if (!user) return false
        if (Array.isArray(role)) return role.includes(user.role)
        return user.role === role
      },

      hasPermission: (permission) => {
        const { user } = get()
        if (!user || !user.permissions) return false
        return user.permissions.includes(permission)
      },
    }),
    {
      name: 'rsm-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export default useAuthStore
