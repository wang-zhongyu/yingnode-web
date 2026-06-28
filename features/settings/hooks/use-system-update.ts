"use client"

import { useReducer, useCallback } from "react"

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

interface UpdateState {
  checking: boolean
  updating: boolean
  check: CheckResult | null
  steps: ProgressStep[]
  updateDone: boolean
}

type UpdateAction =
  | { type: "START_CHECK" }
  | { type: "CHECK_RESULT"; check: CheckResult }
  | { type: "CHECK_ERROR" }
  | { type: "START_UPDATE" }
  | { type: "UPDATE_STEP"; step: ProgressStep }
  | { type: "UPDATE_ERROR" }
  | { type: "FINISH_UPDATE" }

const initialState: UpdateState = {
  checking: false,
  updating: false,
  check: null,
  steps: [],
  updateDone: false,
}

function reducer(state: UpdateState, action: UpdateAction): UpdateState {
  if (action.type === "START_CHECK") {
    return { ...state, checking: true, check: null }
  }
  if (action.type === "CHECK_RESULT") {
    return { ...state, checking: false, check: action.check }
  }
  if (action.type === "CHECK_ERROR") {
    return {
      ...state,
      checking: false,
      check: {
        currentVersion: "?",
        commitsBehind: 0,
        hasUpdate: false,
        latestCommits: [],
        error: "检查失败，请确认网络连接",
      },
    }
  }
  if (action.type === "START_UPDATE") {
    return { ...state, updating: true, steps: [], updateDone: false }
  }
  if (action.type === "UPDATE_STEP") {
    return {
      ...state,
      steps: [...state.steps, action.step],
      updateDone: action.step.done ? true : state.updateDone,
    }
  }
  if (action.type === "UPDATE_ERROR") {
    return {
      ...state,
      updating: false,
      steps: [
        ...state.steps,
        { step: "error", message: "更新请求失败", done: true },
      ],
    }
  }
  if (action.type === "FINISH_UPDATE") {
    return { ...state, updating: false }
  }
  return state
}

export function useSystemUpdate() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const handleCheck = useCallback(async () => {
    dispatch({ type: "START_CHECK" })
    try {
      const res = await fetch("/api/update/check")
      const data = await res.json()
      dispatch({ type: "CHECK_RESULT", check: data })
    } catch {
      dispatch({ type: "CHECK_ERROR" })
    }
  }, [])

  const handleUpdate = useCallback(async () => {
    dispatch({ type: "START_UPDATE" })

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
            dispatch({ type: "UPDATE_STEP", step })
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      dispatch({ type: "UPDATE_ERROR" })
    } finally {
      dispatch({ type: "FINISH_UPDATE" })
    }
  }, [])

  const progress = state.steps.filter((s) => !s.done)
  const doneSteps = state.steps.filter((s) => s.done && s.step !== "error")
  const errorStep = state.steps.find((s) => s.step === "error")

  return {
    checking: state.checking,
    updating: state.updating,
    check: state.check,
    steps: state.steps,
    updateDone: state.updateDone,
    progress,
    doneSteps,
    errorStep,
    handleCheck,
    handleUpdate,
  }
}
