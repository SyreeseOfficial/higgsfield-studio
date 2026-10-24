"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

import { logError } from "@/lib/studio/logger"

/** Keeps one bad record or render bug from blanking the whole app. */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (reset: () => void) => ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logError("studio", error, info.componentStack ?? undefined)
  }

  override render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children
  }
}
