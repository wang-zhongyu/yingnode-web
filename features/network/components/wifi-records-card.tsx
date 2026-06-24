"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Plus } from "lucide-react"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { WiFiRecordItem } from "./wifi-record-item"
import type { WiFiRecordItem as WiFiRecordItemType } from "@/shared/types/network"

export function WiFiRecordsCard() {
  const [records, setRecords] = useState<WiFiRecordItemType[]>([])
  const [loading, setLoading] = useState(true)
  const { open } = useModalStore()

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/network/wifi-records")
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch {
      // keep existing records on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  function handleAdd() {
    open("manualAddNetwork")
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>已保存的 Wi-Fi 网络</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>已保存的 Wi-Fi 网络</CardTitle>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            暂无已保存的 Wi-Fi 网络
          </p>
        ) : (
          records.map((record, index) => (
            <div key={record.id}>
              <WiFiRecordItem record={record} onDeleted={fetchRecords} />
              {index < records.length - 1 && <Separator />}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
