

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "./ui/button"

export function ThemeSwitcher() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)

    if (newTheme) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="cursor-pointer block rounded-full hover:bg-[var(--accent)] transition-all duration-200"
    >
      {isDark ? (
        <Moon className="h-4 w-4 text-[var(--foreground)]" />
      ) : (
        <Sun className="h-4 w-4 text-[var(--foreground)]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
