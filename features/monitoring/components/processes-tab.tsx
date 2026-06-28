"use client"

import { useProcesses } from "../hooks/use-processes"
import { ListEmpty } from "@/shared/components/list-empty"
import type { ProcessInfo } from "@/shared/types/monitoring"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProcessesTab() {
  const { processes, isLoading, error } = useProcesses("cpu", 50)

  if (error) return <ListEmpty message="无法获取进程列表" />

  if (isLoading) return <Skeleton className="h-96 w-full" />

  if (processes.length === 0) return <ListEmpty message="暂无进程数据" />

  return (
    <Card>
      <CardContent>
        <div className="pt-6">
        <div className="overflow-x-auto">
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
              <TableCell className="max-w-[200px]" title={p.name}><span className="truncate font-medium">{p.name}</span></TableCell>
              <TableCell>{p.pid}</TableCell>
              <TableCell>{p.user}</TableCell>
              <TableCell>{p.cpu.toFixed(1)}</TableCell>
              <TableCell>{p.mem.toFixed(1)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </div>
        </div>
      </CardContent>
    </Card>
  )
}
