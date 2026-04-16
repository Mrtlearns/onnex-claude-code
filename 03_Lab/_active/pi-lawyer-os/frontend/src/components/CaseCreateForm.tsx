import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCase } from '@/hooks/useCases';
import { useCreateClient } from '@/hooks/useClients';
import type { CaseType } from '@/types';

// ── Schema ─────────────────────────────────────────────────

const schema = z.object({
  // Client fields
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  dob: z.string().optional(),
  // Case fields
  case_number: z.string().optional(),
  case_type: z.enum(['auto', 'slip-fall', 'dog-bite', 'premises-liability', 'other']),
  date_of_loss: z.string().optional(),
  sol_date: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ──────────────────────────────────────────────────

interface CaseCreateFormProps {
  onSuccess: (caseId: string) => void;
  /** Pre-fill from a signed lead */
  defaultValues?: Partial<FormValues>;
  leadId?: string;
}

// ── Component ──────────────────────────────────────────────

export default function CaseCreateForm({ onSuccess, defaultValues, leadId }: CaseCreateFormProps) {
  const createClient = useCreateClient();
  const createCase = useCreateCase();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      case_type: 'auto',
      ...defaultValues,
    },
  });

  const caseType = watch('case_type');

  async function onSubmit(values: FormValues) {
    // 1. Create client record
    const client = await createClient.mutateAsync({
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone ?? null,
      email: values.email || null,
      dob: values.dob ?? null,
      address: null,
      injury_description: values.description ?? null,
      insurance_carrier: null,
      insurance_policy: null,
      insurance_adjuster: null,
      adjuster_phone: null,
    });

    // 2. Create case linked to client (and optional lead)
    const newCase = await createCase.mutateAsync({
      client_id: client.id,
      lead_id: leadId ?? null,
      case_number: values.case_number ?? null,
      case_type: values.case_type as CaseType,
      date_of_loss: values.date_of_loss ?? null,
      sol_date: values.sol_date ?? null,
      status: 'intake',
      description: values.description ?? null,
      assigned_attorney: null,
    });

    onSuccess(newCase.id);
  }

  const error = createClient.error ?? createCase.error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Client section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client Information</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="first_name">First Name *</Label>
          <Input id="first_name" {...register('first_name')} />
          {errors.first_name && <p className="text-xs text-red-500">{errors.first_name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="last_name">Last Name *</Label>
          <Input id="last_name" {...register('last_name')} />
          {errors.last_name && <p className="text-xs text-red-500">{errors.last_name.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" {...register('phone')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" {...register('dob')} />
        </div>
      </div>

      {/* Case section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">Case Details</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="case_number">Case Number</Label>
          <Input id="case_number" placeholder="2026-DEMO-001" {...register('case_number')} />
        </div>
        <div className="space-y-1">
          <Label>Case Type *</Label>
          <Select value={caseType} onValueChange={(v) => setValue('case_type', v as CaseType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto Accident</SelectItem>
              <SelectItem value="slip-fall">Slip & Fall</SelectItem>
              <SelectItem value="dog-bite">Dog Bite</SelectItem>
              <SelectItem value="premises-liability">Premises Liability</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="date_of_loss">Date of Loss</Label>
          <Input id="date_of_loss" type="date" {...register('date_of_loss')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sol_date">SOL Date</Label>
          <Input id="sol_date" type="date" {...register('sol_date')} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
          {error.message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Case'}
        </Button>
      </div>
    </form>
  );
}
