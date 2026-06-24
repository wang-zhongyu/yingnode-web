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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <Spinner data-icon="inline-start" /> : null}
        保存设置
      </Button>
    </form>
  )
}
