"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
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
  const form = useForm<ManualAddInput>({
    resolver: zodResolver(manualAddSchema),
    defaultValues: { ssid: initialSSID, password: "", security: "WPA2" },
  })

  function onSubmit(values: ManualAddInput) {
    onConnect(values.ssid.trim(), values.password ?? "", values.security)
  }

  return (
    <Form {...form}>
      <form
        id="manual-add-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 py-2"
      >
        <FormField
          control={form.control}
          name="ssid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>网络名称 (SSID)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="输入 Wi-Fi 名称"
                  disabled={connecting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="security"
          render={({ field }) => (
            <FormItem>
              <FormLabel>安全类型</FormLabel>
              <FormControl>
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder="输入密码（开放网络留空）"
                  disabled={connecting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
