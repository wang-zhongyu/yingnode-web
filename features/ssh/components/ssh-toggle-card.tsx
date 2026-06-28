"use client"

import { useState } from "react"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { toggleSshAction } from "@/actions/ssh.actions"
import { AlertDialogRoot } from "@/shared/components/alert-dialog-root"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface SshToggleCardProps {
  initialActive: boolean
}

export function SshToggleCard({ initialActive }: SshToggleCardProps) {
  const [active, setActive] = useState(initialActive)
  const [showDisableDialog, setShowDisableDialog] = useState(false)

  const { execute, isPending } = useAction(toggleSshAction, {
    onSuccess({ input }) {
      setActive(input.enable)
      toast.success(input.enable ? "SSH 已启用" : "SSH 已停用")
    },
    onError({ error }) {
      toast.error(error.serverError ?? "操作失败")
    },
  })

  function handleToggle() {
    if (active) {
      setShowDisableDialog(true)
    } else {
      execute({ enable: true })
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>SSH 服务</CardTitle>
          <CardDescription>管理 SSH 远程登录服务</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">当前状态</span>
            <Badge variant={active ? "default" : "secondary"}>
              {active ? "运行中" : "已停止"}
            </Badge>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant={active ? "destructive" : "default"}
            onClick={handleToggle}
            disabled={isPending}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {active ? "停用 SSH" : "启用 SSH"}
          </Button>
        </CardFooter>
      </Card>

      <AlertDialogRoot
        open={showDisableDialog}
        onOpenChange={setShowDisableDialog}
        title="停用 SSH 服务"
        description="停用 SSH 后，你将无法通过 SSH 远程登录此设备。确定停用？"
        confirmLabel="确定停用"
        variant="destructive"
        onConfirm={() => {
          execute({ enable: false })
          setShowDisableDialog(false)
        }}
      />
    </>
  )
}
