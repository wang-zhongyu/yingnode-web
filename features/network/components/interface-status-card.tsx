import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ListEmpty } from "@/shared/components/list-empty"
import { networkService } from "@/shared/lib/network-service"
import { InterfaceListItem } from "./interface-list-item"

export async function InterfaceStatusCard() {
  const interfaces = await networkService.getInterfaceStatuses()

  if (interfaces.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>网口状态</CardTitle>
        </CardHeader>
        <CardContent>
          <ListEmpty message="无法获取网口状态" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>网口状态</CardTitle>
      </CardHeader>
      <CardContent>
        {interfaces.map((iface, index) => (
          <div key={iface.name}>
            <InterfaceListItem {...iface} />
            {index < interfaces.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
