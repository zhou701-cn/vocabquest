import type { AuthUser, User } from '@/types'

const PLACEHOLDER_NAMES = new Set([
  'user',
  'student user',
  'demo student',
  'demo user',
  'demo',
  'student',
])

function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true
  return PLACEHOLDER_NAMES.has(name.trim().toLowerCase())
}

/**
 * 返回用于顶部导航栏、下拉菜单等位置的显示昵称：
 * - 如果 full_name 存在且不是占位名，优先用它
 * - 否则用邮箱前缀（@ 前面部分）作为默认昵称
 * - 都没有时回退到 'User'
 */
export function getUserNickname(user: AuthUser | null, profile: User | null): string {
  const fullName = profile?.full_name || user?.full_name
  if (!isPlaceholderName(fullName)) {
    return fullName!.trim()
  }
  return user?.email?.split('@')[0]?.trim() || 'User'
}

/**
 * 返回昵称首字母，用于头像展示；昵称缺失时返回 'U'
 */
export function getUserInitial(nickname: string): string {
  return nickname[0]?.toUpperCase() || 'U'
}

/**
 * 返回用于欢迎语的“名字/称呼”：
 * - 有真实 full_name 时取第一个词
 * - 否则用邮箱前缀
 * - 都缺失时回退到 'Student'
 */
export function getUserFirstName(user: AuthUser | null, profile: User | null): string {
  const fullName = profile?.full_name || user?.full_name
  if (!isPlaceholderName(fullName)) {
    return fullName!.trim().split(' ')[0]
  }
  return user?.email?.split('@')[0]?.trim() || 'Student'
}
