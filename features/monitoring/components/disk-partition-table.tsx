"use client"

import { useDiskPartitions } from "../hooks/use-disk-partitions"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export function DiskPartitionTable() {
  const { partitions, isLoading, error } = useDiskPartitions()

  if (isLoading) return <Skeleton className="h-48 w-full" />

  if (error) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        无法获取分区信息
      </p>
    )
  }

  if (partitions.length === 0) return null

  return (
    <div className="overflow-x-auto">
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
          {partitions.map((p) => (
            <TableRow key={`${p.filesystem}-${p.mountedOn}`}>
              <TableCell className="max-w-[150px] truncate font-medium" title={p.filesystem}>{p.filesystem}</TableCell>
              <TableCell>{p.size}</TableCell>
              <TableCell>{p.used}</TableCell>
              <TableCell>{p.available}</TableCell>
              <TableCell>{p.usePercent}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={p.mountedOn}>{p.mountedOn}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
