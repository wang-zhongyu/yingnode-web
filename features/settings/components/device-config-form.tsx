"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import {
  deviceConfigSchema,
  type DeviceConfigInput,
} from "@/features/settings/schemas/device-config.schema"
import { updateDeviceConfigAction } from "@/actions/settings.actions"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

interface Props {
  config: {
    wifiInterface: string
    hotspotIp: string
    hotspotSsid: string
    hotspotPassword: string
  }
}

export function DeviceConfigForm({ config }: Props) {
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<DeviceConfigInput>({
    resolver: zodResolver(deviceConfigSchema),
    defaultValues: config,
  })

  const { execute, isPending } = useAction(updateDeviceConfigAction, {
    onSuccess() {
      toast.success("设置已保存，下次网络操作时生效")
    },
    onError({ error }) {
      toast.error(error.serverError ?? "保存失败")
    },
  })

  return (
    <Form {...form}>
      <form id="device-config-form" onSubmit={form.handleSubmit(execute)}>
        <Card>
          <CardHeader>
            <CardTitle>设备配置</CardTitle>
            <CardDescription>配置 WiFi 网卡、热点 IP、SSID 和密码等基本参数</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="wifiInterface"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WiFi 网卡接口</FormLabel>
                  <FormControl>
                    <Input placeholder="wlan0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hotspotIp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>热点 IP 地址</FormLabel>
                  <FormControl>
                    <Input placeholder="172.16.42.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hotspotSsid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>热点 SSID</FormLabel>
                  <FormControl>
                    <Input placeholder="yingnode" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hotspotPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>热点密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="请输入热点密码（至少 8 位）"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              保存设置
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
