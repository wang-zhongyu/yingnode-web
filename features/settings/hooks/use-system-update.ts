"use client"

import { useState, useCallback } from "react"

interface CheckResult {
  currentVersion: string
  commitsBehind: number
  hasUpdate: boolean
  latestCommits: string[]
  error?: string
}

interface ProgressStep {
  step: string
  message: string
  done: boolean
  output?: string
  oldVersion?: string
  newVersion?: string
}

export function useSystemUpdate() {
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [updateDone, setUpdateDone] = useState(false)

  const handleCheck = useCallback(async () => {
    setChecking(true)
    setCheck(null)
    try {
      const res = await fetch("/api/update/check")
      const data = await res.json()
      setCheck(data)
    } catch {
      setCheck({
        currentVersion: "?",
        commitsBehind: 0,
        hasUpdate: false,
        latestCommits: [],
        error: "检查失败，请确认网络连接",
      })
    } finally {
      setChecking(false)
    }
  }, [])

  const handleUpdate = useCallback(async () => {
    setUpdating(true)
    setSteps([])
    setUpdateDone(false)

    try {
      const res = await fetch("/api/update", { method: "POST" })
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data: ")) continue
          try {
            const step = JSON.parse(trimmed.slice(6)) as ProgressStep
            setSteps((prev) => [...prev, step])
            if (step.done) setUpdateDone(true)
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setSteps((prev) => [
        ...prev,
        { step: "error", message: "更新请求失败", done: true },
      ])
    } finally {
      setUpdating(false)
    }
  }, [])

  const progress = steps.filter((s) => !s.done)
  const doneSteps = steps.filter((s) => s.done && s.step !== "error")
  const errorStep = steps.find((s) => s.step === "error")

  return {
    checking,
    updating,
    check,
    steps,
    updateDone,
    progress,
    doneSteps,
    errorStep,
    handleCheck,
    handleUpdate,
  }
}
