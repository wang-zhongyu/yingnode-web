"use client"

import { useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Plus } from "lucide-react"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { WiFiRecordItem } from "./wifi-record-item"
import type { WiFiRecordItem as WiFiRecordItemType } from "@/shared/types/network"

interface WiFiRecordsCardProps {
  initialRecords: WiFiRecordItemType[]
}

export function WiFiRecordsCard({ initialRecords }: WiFiRecordsCardProps) {
  const [records, setRecords] = useState<WiFiRecordItemType[]>(initialRecords)
  const { open } = useModalStore()

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/network/wifi-records")
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch {
      // keep existing records on error
    }
  }, [])

  function handleAdd() {
    open("manualAddNetwork")
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>已保存的 Wi-Fi 网络</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            暂无已保存的 Wi-Fi 网络
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>已保存的 Wi-Fi 网络</CardTitle>
      </CardHeader>
      <CardContent>
        {records.map((record, index) => (
          <div key={record.id}>
            <WiFiRecordItem record={record} onDeleted={fetchRecords} />
            {index < records.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </CardFooter>
    </Card>
  )
}
