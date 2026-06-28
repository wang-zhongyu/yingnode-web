"use client"

import { useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Plus } from "lucide-react"
import { ModalButton } from "@/shared/components/modal-button"
import { WiFiRecordItem } from "./wifi-record-item"
import type { WiFiRecordItem as WiFiRecordItemType } from "@/shared/types/network"

interface WiFiRecordsCardProps {
  initialRecords: WiFiRecordItemType[]
}

export function WiFiRecordsCard({ initialRecords }: WiFiRecordsCardProps) {
  const [records, setRecords] = useState<WiFiRecordItemType[]>(initialRecords)

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/network/wifi-records")
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch {
      // keep existing records on error
    }
  }, [])

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
          <ModalButton modalType="manualAddNetwork" label="添加" icon={Plus} variant="outline" size="sm" />
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
        <ModalButton modalType="manualAddNetwork" label="添加" icon={Plus} variant="outline" size="sm" />
      </CardFooter>
    </Card>
  )
}
