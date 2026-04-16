"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Task, TaskStatus } from "@/types/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { TaskDetailDialog } from "./task-detail-dialog"

const STATUS_OPTIONS: TaskStatus[] = ["Backlog", "In Progress", "Review", "Done"]
type SortField = "title" | "status" | "due_date" | "created_at"

export function TaskListView({ tasks }: { tasks: Task[] }) {
  const qc = useQueryClient()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const { mutate: patchStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) =>
      fetch(`/api/bff/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    const aVal = (a[sortField] ?? "") as string
    const bVal = (b[sortField] ?? "") as string
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
  })

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => toggleSort("title")}>
                Title {sortField === "title" ? (sortDir === "asc" ? "up" : "down") : ""}
              </Button>
            </TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => toggleSort("due_date")}>
                Due Date {sortField === "due_date" ? (sortDir === "asc" ? "up" : "down") : ""}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => toggleSort("status")}>
                Status {sortField === "status" ? (sortDir === "asc" ? "up" : "down") : ""}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(task => (
            <TableRow key={task.id}>
              <TableCell>
                <button
                  className="text-sm font-medium hover:underline text-left"
                  onClick={() => setSelectedTask(task)}
                >
                  {task.title}
                </button>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {task.project_id ? task.project_id.slice(0, 8) + "..." : "none"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {task.assignee_id ? task.assignee_id.slice(0, 8) + "..." : "none"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {task.due_date ?? "none"}
              </TableCell>
              <TableCell>
                <Select
                  value={task.status}
                  onValueChange={(val) => patchStatus({ id: task.id, status: val as TaskStatus })}
                >
                  <SelectTrigger className="w-36 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
        />
      )}
    </>
  )
}
