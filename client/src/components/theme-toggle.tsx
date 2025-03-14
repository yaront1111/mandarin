"use client"

import { useEffect, useState } from "react"
import { FaMoon, FaSun } from "react-icons/fa"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  // Initialize theme based on user preference or localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    } else {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    }
    setIsDark(!isDark)
  }

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <FaSun /> : <FaMoon />}
    </button>
  )
}
