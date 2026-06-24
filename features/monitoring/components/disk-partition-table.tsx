"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface Partition {
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: string
  mountedOn: string
}

export function DiskPartitionTable() {
  const [partitions, setPartitions] = useState<Partition[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPartitions = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/disk")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setPartitions(data.partitions)
    } catch {
      setPartitions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPartitions()
  }, [fetchPartitions])

  if (isLoading) return <Skeleton className="h-48 w-full" />

  if (partitions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        无法获取分区信息
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>文件系统</TableHead>
          <TableHead>大小</TableHead>
          <TableHead>已用</TableHead>
          <TableHead>可用</TableHead>
          <TableHead>使用率</TableHead>
          <TableHead>挂载点</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partitions.map((p, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{p.filesystem}</TableCell>
            <TableCell>{p.size}</TableCell>
            <TableCell>{p.used}</TableCell>
            <TableCell>{p.available}</TableCell>
            <TableCell>{p.usePercent}</TableCell>
            <TableCell>{p.mountedOn}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
