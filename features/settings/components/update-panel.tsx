"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card } from "@/components/ui/card"
import { RefreshCwIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"

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

const STEP_LABELS: Record<string, string> = {
  fetch: "获取代码",
  pull: "合并代码",
  install: "安装依赖",
  prisma: "生成 Prisma",
  build: "构建应用",
  db: "同步数据库",
  restart: "重启服务",
}

export function UpdatePanel() {
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
      setCheck({ currentVersion: "?", commitsBehind: 0, hasUpdate: false, latestCommits: [], error: "检查失败，请确认网络连接" })
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
      setSteps((prev) => [...prev, { step: "error", message: "更新请求失败", done: true }])
    } finally {
      setUpdating(false)
    }
  }, [])

  const progress = steps.filter((s) => !s.done)
  const doneSteps = steps.filter((s) => s.done && s.step !== "error")
  const errorStep = steps.find((s) => s.step === "error")

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">系统更新</h3>
          <p className="text-sm text-muted-foreground">
            当前版本 {check?.currentVersion ?? "..."}
            {check?.hasUpdate && (
              <span className="text-amber-500"> · {check.commitsBehind} 个新提交</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
          {checking ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon className="size-4" />}
          检查更新
        </Button>
      </div>

      {check?.error && (
        <p className="text-sm text-destructive">{check.error}</p>
      )}

      {check?.hasUpdate && !updating && !updateDone && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">待更新：</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {check.latestCommits.map((c, i) => (
              <li key={i} className="font-mono">{c}</li>
            ))}
          </ul>
          <Button size="sm" onClick={handleUpdate}>
            立即更新
          </Button>
        </div>
      )}

      {/* Progress */}
      {updating && progress.length > 0 && (
        <div className="flex flex-col gap-1">
          {progress.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner data-icon="inline-start" />
              <span>{STEP_LABELS[s.step] ?? s.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Done steps */}
      {doneSteps.length > 0 && (
        <div className="flex flex-col gap-1">
          {doneSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              <span>{s.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {errorStep && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircleIcon className="size-4" />
            <span>{errorStep.message}</span>
          </div>
          {errorStep.output && (
            <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
              {errorStep.output}
            </pre>
          )}
        </div>
      )}

      {check && !check.hasUpdate && !check.error && (
        <p className="text-sm text-emerald-500">已是最新版本</p>
      )}
    </Card>
  )
}
