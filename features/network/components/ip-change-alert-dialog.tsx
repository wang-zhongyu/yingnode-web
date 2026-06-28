"use client"

import { AlertDialogRoot } from "@/shared/components/alert-dialog-root"

interface IpChangeAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessUrl: string
}

export function IpChangeAlertDialog({
  open,
  onOpenChange,
  accessUrl,
}: IpChangeAlertDialogProps) {
  return (
    <AlertDialogRoot
      open={open}
      onOpenChange={onOpenChange}
      title="网络地址已变更"
      description="设备 IP 已更新，请在浏览器中访问以下地址："
      confirmLabel="知道了"
      onConfirm={() => onOpenChange(false)}
      variant="default"
    >
      <div className="py-2 text-center">
        <span className="text-lg font-mono font-semibold tracking-wide select-all">
          {accessUrl}
        </span>
      </div>
    </AlertDialogRoot>
  )
}
