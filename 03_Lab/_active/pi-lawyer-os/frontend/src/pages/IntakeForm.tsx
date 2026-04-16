import { useState, useMemo } from 'react';
import { Scale, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { es } from '@/i18n/es';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface FormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  injury_type: string;
  date_of_loss: string;
  fault: string;
  has_medical: boolean | null;
  notes: string;
}

const INJURY_OPTIONS = [
  { value: 'auto', label: 'Auto Accident' },
  { value: 'slip-fall', label: 'Slip & Fall' },
  { value: 'dog-bite', label: 'Dog Bite' },
  { value: 'premises-liability', label: 'Premises Liability' },
  { value: 'other', label: 'Other Injury' },
];

const FAULT_OPTIONS = [
  { value: 'yes', label: 'Yes — the other party was at fault' },
  { value: 'no', label: 'No — I may have been at fault' },
  { value: 'unsure', label: "I'm not sure" },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className={[
            'h-2 rounded-full transition-all',
            n === current ? 'w-8 bg-indigo-600' : n < current ? 'w-4 bg-indigo-300' : 'w-4 bg-gray-200',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// ── Pre-qualification flags ───────────────────────────────────────────────────

function PreQualFlag({ fault, has_medical }: { fault: string; has_medical: boolean | null }) {
  if (fault === 'no') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        We handle cases where another party may be at fault. Our attorneys review all situations —
        submit your information and we'll assess your case for free.
      </div>
    );
  }
  if (has_medical === false) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Even without medical treatment yet, you may still have a valid claim. An attorney will
        evaluate your situation at no cost.
      </div>
    );
  }
  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntakeForm() {
  // Auto-detect Spanish from browser language
  const isSpanish = useMemo(() => {
    const stored = localStorage.getItem('lang');
    if (stored) return stored === 'es';
    return navigator.language.startsWith('es');
  }, []);
  const t = (key: string) => (isSpanish ? (es[key] ?? key) : key);

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    injury_type: '',
    date_of_loss: '',
    fault: '',
    has_medical: null,
    notes: '',
  });

  const set = (field: keyof FormData, value: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canAdvance = (): boolean => {
    if (step === 1) return !!form.first_name.trim() && !!form.phone.trim();
    if (step === 2) return !!form.injury_type && !!form.fault;
    if (step === 3) return form.has_medical !== null;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/auth/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          email: form.email || undefined,
          injury_type: form.injury_type || undefined,
          date_of_loss: form.date_of_loss || undefined,
          fault: form.fault || undefined,
          has_medical: form.has_medical,
          notes: form.notes || undefined,
          source: 'web-form',
        }),
      });

      if (!res.ok) {
        setError('Something went wrong. Please try again or call us directly.');
        setSubmitting(false);
        return;
      }

      setStep(4);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-md">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t('Free Case Evaluation')}</h1>
          <p className="text-sm text-gray-500 text-center">
            {isSpanish ? 'Toma 2 minutos. Un abogado revisa cada solicitud.' : 'Takes 2 minutes. An attorney reviews every submission.'}
          </p>
        </div>

        {/* Step 4 — success screen */}
        {step === 4 && (
          <Card className="shadow-sm text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-gray-900">{t('Thank you!')}</h2>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                {t("We've received your information. An attorney will contact you within 15 minutes.")}
              </p>
              <p className="text-xs text-gray-400 mt-4">
                You can close this page. We'll be in touch shortly.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Steps 1–3 */}
        {step !== 4 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {step === 1 && t('Contact Information')}
                {step === 2 && t('About Your Injury')}
                {step === 3 && t('Medical Treatment')}
              </CardTitle>
              <CardDescription className="text-xs">
                {isSpanish ? `Paso ${step} de 3` : `Step ${step} of 3`}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <StepIndicator current={step} total={3} />

              {/* ── Step 1 ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="first_name">First name <span className="text-red-500">*</span></Label>
                      <Input
                        id="first_name"
                        value={form.first_name}
                        onChange={(e) => set('first_name', e.target.value)}
                        placeholder="Maria"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last_name">Last name</Label>
                      <Input
                        id="last_name"
                        value={form.last_name}
                        onChange={(e) => set('last_name', e.target.value)}
                        placeholder="Garcia"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone number <span className="text-red-500">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email address <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="maria@example.com"
                    />
                  </div>
                </div>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Type of injury <span className="text-red-500">*</span></Label>
                    <Select value={form.injury_type} onValueChange={(v) => set('injury_type', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select injury type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {INJURY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date_of_loss">Date of accident <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="date_of_loss"
                      type="date"
                      value={form.date_of_loss}
                      onChange={(e) => set('date_of_loss', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Was another party at fault? <span className="text-red-500">*</span></Label>
                    <div className="space-y-2">
                      {FAULT_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={[
                            'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                            form.fault === opt.value
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name="fault"
                            value={opt.value}
                            checked={form.fault === opt.value}
                            onChange={() => set('fault', opt.value)}
                            className="mt-0.5 accent-indigo-600"
                          />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <PreQualFlag fault={form.fault} has_medical={form.has_medical} />
                </div>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Have you received medical treatment for your injuries? <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: true, label: 'Yes' },
                        { value: false, label: 'Not yet' },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => set('has_medical', opt.value)}
                          className={[
                            'rounded-lg border p-4 text-sm font-medium transition-colors',
                            form.has_medical === opt.value
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300',
                          ].join(' ')}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PreQualFlag fault={form.fault} has_medical={form.has_medical} />
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Anything else you'd like us to know? <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      rows={3}
                      placeholder="Describe what happened, any injuries, or questions for our team…"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-600 text-center">{error}</p>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                {step > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep((s) => (s - 1) as Step)}
                    disabled={submitting}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />Back
                  </Button>
                ) : (
                  <div />
                )}

                {step < 3 ? (
                  <Button
                    size="sm"
                    onClick={() => setStep((s) => (s + 1) as Step)}
                    disabled={!canAdvance()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Next<ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!canAdvance() || submitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      'Submit My Case'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Free, confidential, no obligation. We only get paid if you win.
        </p>
      </div>
    </div>
  );
}
