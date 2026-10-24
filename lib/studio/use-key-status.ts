"use client"

import { useEffect, useState } from "react"

import { hasPlatformCredentials } from "@/generation/actions"

/** Whether an API key is saved, and the dialog that manages it. The cookie
    can expire or be cleared in another tab, so it is re-read on window focus. */
export function useKeyStatus() {
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    const check = () => void hasPlatformCredentials().then(setConfigured)
    check()
    window.addEventListener("focus", check)
    return () => window.removeEventListener("focus", check)
  }, [])

  return {
    open,
    setOpen,
    configured,
    setConfigured,
    /** The platform refused the key: mark it unset and ask for a new one. */
    reject: () => {
      setConfigured(false)
      setOpen(true)
    },
  }
}
