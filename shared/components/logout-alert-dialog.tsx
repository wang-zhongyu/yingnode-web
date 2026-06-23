"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { signOut } from "@/shared/lib/auth-client"
import { AlertDialogRoot } from "@/shared/components/alert-dialog-root"

interface LogoutAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogoutAlertDialog({ open, onOpenChange }: LogoutAlertDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    setIsPending(true)
    try {
      await signOut()
      toast.success("已退出登录")
      router.push("/login")
    } catch {
      toast.error("退出登录失败")
    } finally {
      setIsPending(false)
      onOpenChange(false)
    }
  }

  return (
    <AlertDialogRoot
      open={open}
      onOpenChange={onOpenChange}
      title="确认退出登录"
      description="退出后需要重新输入邮箱和密码才能登录。"
      confirmLabel="退出登录"
      cancelLabel="取消"
      isPending={isPending}
      onConfirm={handleLogout}
      variant="destructive"
    />
  )
}
