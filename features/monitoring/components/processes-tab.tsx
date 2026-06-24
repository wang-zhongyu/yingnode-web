"use client"

import { useProcesses, type ProcessInfo } from "../hooks/use-processes"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export function ProcessesTab() {
  const { processes, isLoading, error } = useProcesses("cpu", 50)

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">无法获取进程列表</p>
      </div>
    )
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>进程名</TableHead>
          <TableHead>PID</TableHead>
          <TableHead>用户</TableHead>
          <TableHead>CPU %</TableHead>
          <TableHead>内存 %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {processes.map((p: ProcessInfo) => (
          <TableRow key={p.pid}>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell>{p.pid}</TableCell>
            <TableCell>{p.user}</TableCell>
            <TableCell>{p.cpu.toFixed(1)}</TableCell>
            <TableCell>{p.mem.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
