import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore, THEME_STORAGE_KEY } from './theme-store'

describe('theme-store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light')
    useThemeStore.setState({ theme: 'dark' })
  })

  it('setTheme("light") persists the value and adds the light class', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('setTheme("dark") removes the light class', () => {
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().setTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('toggleTheme flips between dark and light', () => {
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('toggleTheme persists the value and updates the light class', () => {
    useThemeStore.getState().toggleTheme()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    useThemeStore.getState().toggleTheme()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})
