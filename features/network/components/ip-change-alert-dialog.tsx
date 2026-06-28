"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>网络地址已变更</AlertDialogTitle>
          <AlertDialogDescription>
            设备 IP 已更新，请在浏览器中访问以下地址：
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2 text-center">
          <span className="text-lg font-mono font-semibold tracking-wide select-all">
            {accessUrl}
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction>知道了</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
