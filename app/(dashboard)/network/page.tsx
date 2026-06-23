export default function NetworkPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">网络管理</h1>
      <p className="text-sm text-muted-foreground">
        点击顶部菜单栏的 Wi-Fi 按钮扫描周边网络并连接。设备断网时将自动开启热点。
      </p>
    </div>
  )
}
