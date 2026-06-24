"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { RefreshCwIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"
import { useSystemUpdate } from "@/features/settings/hooks/use-system-update"

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
  const {
    checking,
    updating,
    check,
    updateDone,
    progress,
    doneSteps,
    errorStep,
    handleCheck,
    handleUpdate,
  } = useSystemUpdate()

  const showFooter = check?.hasUpdate && !updating && !updateDone

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统更新</CardTitle>
        <CardDescription>
          当前版本 {check?.currentVersion ?? "..."}
          {check?.hasUpdate && (
            <span className="text-amber-500">
              {" "}· {check.commitsBehind} 个新提交
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {check?.error && (
          <p className="text-sm text-destructive">{check.error}</p>
        )}

        {check && !check.hasUpdate && !check.error && (
          <p className="text-sm text-emerald-500">已是最新版本</p>
        )}

        {check?.hasUpdate && !updating && !updateDone && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">待更新：</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {check.latestCommits.map((c, i) => (
                <li key={i} className="font-mono">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {progress.length > 0 && (
          <div className="flex flex-col gap-1">
            {progress.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Spinner data-icon="inline-start" />
                <span>{STEP_LABELS[s.step] ?? s.message}</span>
              </div>
            ))}
          </div>
        )}

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
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon className="size-4" />}
          检查更新
        </Button>
        {showFooter && (
          <Button size="sm" onClick={handleUpdate}>
            立即更新
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
