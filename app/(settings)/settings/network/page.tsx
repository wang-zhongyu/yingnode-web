import { ModalButton } from "@/shared/components/modal-button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export default function NetworkSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">网络设置</h1>
      <Card>
        <CardHeader>
          <CardTitle>当前网络状态</CardTitle>
          <CardDescription>查看设备网络连接和热点状态</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">点击下方按钮查看详细的网络状态信息。</p>
        </CardContent>
        <CardFooter>
          <ModalButton modalType="networkSettings" variant="outline">
            查看网络详情
          </ModalButton>
        </CardFooter>
      </Card>
    </div>
  )
}
