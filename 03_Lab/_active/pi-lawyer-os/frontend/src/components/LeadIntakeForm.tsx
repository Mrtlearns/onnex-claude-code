import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
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
import { useCreateLead } from '@/hooks/useLeads';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const schema = z.object({
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]{7,15}$/, 'Enter a valid phone number'),
  email: z
    .string()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('')),
  injury_type: z.enum(
    ['auto', 'slip-fall', 'dog-bite', 'premises-liability', 'other'],
    { required_error: 'Select an injury type' },
  ),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const INJURY_OPTIONS: { value: FormValues['injury_type']; label: string }[] = [
  { value: 'auto', label: 'Auto Accident' },
  { value: 'slip-fall', label: 'Slip & Fall' },
  { value: 'dog-bite', label: 'Dog Bite' },
  { value: 'premises-liability', label: 'Premises Liability' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface LeadIntakeFormProps {
  onSuccess?: () => void;
}

export default function LeadIntakeForm({ onSuccess }: LeadIntakeFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const createLead = useCreateLead();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      notes: '',
    },
  });

  const injuryTypeValue = watch('injury_type');

  const onSubmit = async (values: FormValues) => {
    await createLead.mutateAsync({
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone,
      email: values.email ?? '',
      injury_type: values.injury_type,
      source: 'web-form',
      status: 'new',
      notes: values.notes ?? '',
      assigned_to: null,
    });
    setSubmitted(true);
    reset();
    onSuccess?.();
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-lg font-semibold text-gray-900">Lead created!</p>
        <p className="text-sm text-gray-500">
          The new lead has been added to the pipeline.
        </p>
        <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
          Add another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" {...register('first_name')} placeholder="Jane" />
          {errors.first_name && (
            <p className="text-xs text-red-500">{errors.first_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" {...register('last_name')} placeholder="Doe" />
          {errors.last_name && (
            <p className="text-xs text-red-500">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" {...register('phone')} placeholder="+1 (555) 000-0000" />
        {errors.phone && (
          <p className="text-xs text-red-500">{errors.phone.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="jane@example.com"
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Injury type */}
      <div className="space-y-1.5">
        <Label htmlFor="injury_type">Injury type</Label>
        <Select
          value={injuryTypeValue}
          onValueChange={(val) =>
            setValue('injury_type', val as FormValues['injury_type'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="injury_type">
            <SelectValue placeholder="Select injury type" />
          </SelectTrigger>
          <SelectContent>
            {INJURY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.injury_type && (
          <p className="text-xs text-red-500">{errors.injury_type.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Brief description of the incident..."
          rows={3}
        />
      </div>

      {/* API error */}
      {createLead.isError && (
        <p className="text-sm text-red-500 rounded-md bg-red-50 px-3 py-2">
          {createLead.error?.message ?? 'Failed to create lead. Please try again.'}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={createLead.isPending}>
        {createLead.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating lead…
          </>
        ) : (
          'Create Lead'
        )}
      </Button>
    </form>
  );
}
