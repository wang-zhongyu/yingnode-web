"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useState } from "react"
import {
  deviceConfigSchema,
  type DeviceConfigInput,
} from "@/features/settings/schemas/device-config.schema"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

interface Props {
  config: {
    wifiInterface: string
    hotspotIp: string
    hotspotSsid: string
  }
}

export function DeviceConfigForm({ config }: Props) {
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceConfigInput>({
    resolver: zodResolver(deviceConfigSchema),
    defaultValues: config,
  })

  const onSubmit = async (data: DeviceConfigInput) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/device", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? "保存失败")
      }

      toast.success("设置已保存，下次网络操作时生效")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "保存失败"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="device-config-form" onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>设备配置</CardTitle>
          <CardDescription>配置 WiFi 网卡、热点 IP 和 SSID 等基本参数</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>WiFi 网卡接口</FieldLabel>
              <Input placeholder="wlan0" {...register("wifiInterface")} />
              <FieldError errors={errors.wifiInterface ? [errors.wifiInterface] : undefined} />
            </Field>
            <Field>
              <FieldLabel>热点 IP 地址</FieldLabel>
              <Input placeholder="172.16.42.1" {...register("hotspotIp")} />
              <FieldError errors={errors.hotspotIp ? [errors.hotspotIp] : undefined} />
            </Field>
            <Field>
              <FieldLabel>热点 SSID</FieldLabel>
              <Input placeholder="yingnode" {...register("hotspotSsid")} />
              <FieldError errors={errors.hotspotSsid ? [errors.hotspotSsid] : undefined} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            保存设置
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
