"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import {
  manualAddSchema,
  type ManualAddInput,
} from "../schemas/network.schema"

interface ManualAddFormFieldsProps {
  initialSSID: string
  connecting: boolean
  onConnect: (ssid: string, password: string, security: ManualAddInput["security"]) => void
}

export function ManualAddFormFields({
  initialSSID,
  connecting,
  onConnect,
}: ManualAddFormFieldsProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualAddInput>({
    resolver: zodResolver(manualAddSchema),
    defaultValues: { ssid: initialSSID, password: "", security: "WPA2" },
  })

  function onSubmit(values: ManualAddInput) {
    onConnect(values.ssid.trim(), values.password ?? "", values.security)
  }

  return (
    <form
      id="manual-add-form"
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 py-2"
    >
      <Field>
        <FieldLabel>网络名称 (SSID)</FieldLabel>
        <Input
          {...register("ssid")}
          placeholder="输入 Wi-Fi 名称"
          disabled={connecting}
        />
        <FieldError errors={errors.ssid ? [errors.ssid] : undefined} />
      </Field>
      <Field>
        <FieldLabel>安全类型</FieldLabel>
        <Controller
          control={control}
          name="security"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={connecting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WPA2">WPA2</SelectItem>
                <SelectItem value="WPA">WPA</SelectItem>
                <SelectItem value="OPEN">开放网络</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={errors.security ? [errors.security] : undefined} />
      </Field>
      <Separator />
      <Field>
        <FieldLabel>密码</FieldLabel>
        <Input
          {...register("password")}
          type="password"
          placeholder="输入密码（开放网络留空）"
          disabled={connecting}
        />
        <FieldError errors={errors.password ? [errors.password] : undefined} />
      </Field>
    </form>
  )
}
