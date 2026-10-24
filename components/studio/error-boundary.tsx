"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

/** Keeps one bad record or render bug from blanking the whole app. */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (reset: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[studio] render failed", error, info.componentStack)
  }

  render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children
  }
}
