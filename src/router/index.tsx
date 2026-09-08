import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthPage } from '@/pages/AuthPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { HomePage } from '@/pages/HomePage'
import { FlashcardsPage } from '@/pages/FlashcardsPage'
import { QuizPage } from '@/pages/QuizPage'
import { SpellingPage } from '@/pages/SpellingPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { LanguagePage } from '@/pages/LanguagePage'
import { AdminPage } from '@/pages/AdminPage'
import { PoemPage } from '@/pages/PoemPage'
import { ProfilePage } from '@/pages/ProfilePage'
/**
 * 集中式路由配置（组织方式对照 vue-router 的 router/index.ts）。
 *
 * 使用 react-router-dom v6 的 createBrowserRouter 数据路由 API，
 * 在 App.tsx 中通过 <RouterProvider router={router} /> 挂载。
 *
 * 守卫机制：受保护路由统一用 <ProtectedRoute> 包裹实现
 * （等价于 vue-router 的全局 beforeEach 守卫）。
 */
export const router = createBrowserRouter([
  // ---- 公开路由 ----
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },

  // ---- 受保护路由（需登录） ----
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Navigate to="/index" replace />
      </ProtectedRoute>
    ),
  },
  {
    path: '/poem',
    element: (
        <ProtectedRoute>
            <PoemPage/>
        </ProtectedRoute>
    )
  },
  {
    path: '/poem/:projectId',
    element: (
        <ProtectedRoute>
            <PoemPage/>
        </ProtectedRoute>
    )
  },
  {
    path: '/poem/:projectId/:poemId',
    element: (
        <ProtectedRoute>
            <PoemPage/>
        </ProtectedRoute>
    )
  },
  {
    path: '/language',
    element: (
      <ProtectedRoute>
        <LanguagePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/index',
    element:(
        <ProtectedRoute>
            <HomePage />
        </ProtectedRoute>
    )
  },
  {
    path: '/flashcards',
    element: (
      <ProtectedRoute>
        <FlashcardsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/quiz',
    element: (
      <ProtectedRoute>
        <QuizPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/spelling',
    element: (
      <ProtectedRoute>
        <SpellingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/review',
    element: (
      <ProtectedRoute>
        <ReviewPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },

  // ---- 受保护路由（需 admin 角色） ----
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredRole="admin">
        <AdminPage />
      </ProtectedRoute>
    ),
  },

  // ---- 兜底路由：未匹配的路径重定向回首页 ----
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
