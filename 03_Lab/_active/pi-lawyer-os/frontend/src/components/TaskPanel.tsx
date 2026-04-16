import { useState } from 'react';
import { PlusCircle, Check, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTasks, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import type { Task, TaskType } from '@/types';

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  sol: 'SOL Deadline',
  hearing: 'Hearing',
  deposition: 'Deposition',
  demand: 'Demand Deadline',
  response: 'Response Due',
  general: 'General',
};

const TYPE_COLOR: Record<TaskType, string> = {
  sol: 'bg-red-100 text-red-700',
  hearing: 'bg-purple-100 text-purple-700',
  deposition: 'bg-blue-100 text-blue-700',
  demand: 'bg-orange-100 text-orange-700',
  response: 'bg-yellow-100 text-yellow-700',
  general: 'bg-gray-100 text-gray-600',
};

function taskUrgency(dueDate: string | null): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!dueDate) return 'none';
  const days = (new Date(dueDate).getTime() - Date.now()) / 86400000;
  if (days < 0) return 'overdue';
  if (days <= 3) return 'soon';
  return 'ok';
}

interface AddTaskFormProps {
  caseId: string;
  firmId: string;
  onDone: () => void;
}

function AddTaskForm({ caseId, onDone }: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('general');
  const [dueDate, setDueDate] = useState('');
  const create = useCreateTask();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({
      case_id: caseId,
      title: title.trim(),
      description: null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      task_type: type,
      assigned_to: null,
      created_by: null,
      status: 'open',
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
      <div className="space-y-1">
        <Label className="text-xs">Task Title *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Request medical records from Sunrise" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(TASK_TYPE_LABEL) as [TaskType, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Due Date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={create.isPending || !title.trim()}>
          {create.isPending ? 'Adding…' : 'Add Task'}
        </Button>
      </div>
    </form>
  );
}

interface TaskRowProps {
  task: Task;
}

function TaskRow({ task }: TaskRowProps) {
  const update = useUpdateTask();
  const urgency = taskUrgency(task.due_date);

  function complete() {
    update.mutate({ id: task.id, data: { status: 'completed' } });
  }

  const urgencyIcon = {
    overdue: <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
    soon: <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
    ok: null,
    none: null,
  }[urgency];

  return (
    <div className={[
      'flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 text-sm',
      urgency === 'overdue' ? 'bg-red-50/40' : '',
    ].join(' ')}>
      <button
        onClick={complete}
        disabled={update.isPending}
        className="flex-shrink-0 w-5 h-5 rounded border border-gray-300 hover:border-green-400 hover:bg-green-50 flex items-center justify-center transition-colors"
        title="Mark complete"
      >
        <Check className="w-3 h-3 text-transparent hover:text-green-500" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {urgencyIcon}
          {task.due_date && (
            <span className={[
              'text-xs',
              urgency === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-500',
            ].join(' ')}>
              {urgency === 'overdue' ? 'Overdue — ' : ''}
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <span className={['text-xs font-medium rounded-full px-2 py-0.5 shrink-0', TYPE_COLOR[task.task_type]].join(' ')}>
        {TASK_TYPE_LABEL[task.task_type]}
      </span>
    </div>
  );
}

interface TaskPanelProps {
  caseId: string;
  firmId: string;
}

export default function TaskPanel({ caseId, firmId }: TaskPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const { data: tasks, isLoading } = useTasks({ case_id: caseId });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Tasks & Deadlines</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} disabled={showAdd}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          Add Task
        </Button>
      </div>

      {showAdd && (
        <AddTaskForm caseId={caseId} firmId={firmId} onDone={() => setShowAdd(false)} />
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading tasks…</p>}

      {!isLoading && tasks?.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 py-4 text-center">No open tasks.</p>
      )}

      {tasks && tasks.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 px-3">
          {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  );
}
