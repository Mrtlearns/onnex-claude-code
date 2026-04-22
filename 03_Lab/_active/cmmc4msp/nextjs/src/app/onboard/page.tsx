'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'

const TOTAL_STEPS = 6
const STEPS = [
  'Cert Level',
  'Org Details',
  'System Scoping',
  'N/A Controls',
  'Review',
  'Submit',
]

const COMMON_EXCLUSIONS = [
  { id: 'no_wireless', label: 'No wireless access in scope (excludes 3.1.16, 3.1.17)', controls: ['3.1.16', '3.1.17'] },
  { id: 'no_mobile', label: 'No mobile devices in scope (excludes 3.1.18)', controls: ['3.1.18'] },
  { id: 'physical_only', label: 'Physical-only facility — no remote workers (excludes PE controls)', controls: ['3.10.1', '3.10.2', '3.10.3', '3.10.4', '3.10.5', '3.10.6'] },
  { id: 'no_public_systems', label: 'No publicly accessible systems (excludes 3.13.5)', controls: ['3.13.5'] },
  { id: 'no_removable_media', label: 'No removable media usage (excludes 3.8.7, 3.8.8)', controls: ['3.8.7', '3.8.8'] },
]

interface FormData {
  cmmcLevel: 2 | 3
  orgName: string
  cageCode: string
  contactName: string
  contactEmail: string
  contactPhone: string
  systemName: string
  systemDescription: string
  cuiTypes: string
  userCount: string
  exclusions: string[]
}

const initialForm: FormData = {
  cmmcLevel: 2,
  orgName: '',
  cageCode: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  systemName: '',
  systemDescription: '',
  cuiTypes: '',
  userCount: '',
  exclusions: [],
}

export default function OnboardPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ slug: string; orgName: string; cmmcLevel: 2 | 3 } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const update = (field: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const toggleExclusion = (id: string) => {
    setForm((f) => ({
      ...f,
      exclusions: f.exclusions.includes(id)
        ? f.exclusions.filter((e) => e !== id)
        : [...f.exclusions, id],
    }))
  }

  const validateStep = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (step === 2) {
      if (!form.orgName.trim()) errs.orgName = 'Organization name is required'
      if (!form.contactEmail.trim()) errs.contactEmail = 'Contact email is required'
    }
    if (step === 3) {
      if (!form.systemName.trim()) errs.systemName = 'System name is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const back = () => setStep((s) => Math.max(s - 1, 1))

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'
      const payload = {
        cmmc_level: form.cmmcLevel,
        org_name: form.orgName,
        cage_code: form.cageCode || null,
        primary_contact_name: form.contactName || null,
        primary_contact_email: form.contactEmail,
        primary_contact_phone: form.contactPhone || null,
        system_name: form.systemName,
        system_description: form.systemDescription || null,
        cui_types: form.cuiTypes || null,
        user_count: form.userCount ? parseInt(form.userCount) : null,
        na_control_ids: form.exclusions.flatMap(
          (id) => COMMON_EXCLUSIONS.find((e) => e.id === id)?.controls || []
        ),
      }
      const res = await fetch(`${API_URL}/api/orgs/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || 'Onboarding failed')
      }
      const data = await res.json()
      setSubmitResult({ slug: data.org_slug, orgName: form.orgName, cmmcLevel: form.cmmcLevel })
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitResult) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Client Onboarded!</h1>
        <p className="text-gray-500 mb-8">
          {submitResult.orgName} has been created with {submitResult.cmmcLevel === 3 ? '145' : '110'} CMMC Level {submitResult.cmmcLevel} controls auto-seeded.
        </p>
        <Link
          href={`/${submitResult.slug}/dashboard`}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
          <ChevronRightIcon className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Onboard New Client</h1>
      <p className="text-sm text-gray-500 mb-8">
        Set up a new defense contractor organization for CMMC compliance.
      </p>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => {
            const num = i + 1
            const done = num < step
            const active = num === step
            return (
              <div key={num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      done
                        ? 'bg-green-500 text-white'
                        : active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {done ? <CheckCircleIcon className="w-5 h-5" /> : num}
                  </div>
                  <span
                    className={`text-xs mt-1 whitespace-nowrap ${
                      active ? 'text-blue-600 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-12 mx-1 mb-4 transition-colors ${
                      done ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {/* Step 1: Certification Level */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Certification Target</h2>
            <p className="text-sm text-gray-500">Select the CMMC certification level this client is pursuing. This drives control scope, scoring method, and all deliverables.</p>
            <div className="space-y-3">
              {([
                {
                  level: 2 as const,
                  title: 'CMMC Level 2',
                  subtitle: 'NIST SP 800-171 Rev 2 · 110 controls · SPRS scored',
                  detail: 'Self-assessment or C3PAO third-party assessment. Required for most DoD contracts handling CUI.',
                },
                {
                  level: 3 as const,
                  title: 'CMMC Level 3',
                  subtitle: 'NIST SP 800-172 · 145 controls · DIBCAC government assessment',
                  detail: 'Government-led assessment by DCSA. Required for contracts involving highest priority programs. Includes all Level 2 requirements plus 35 enhanced controls.',
                },
              ] as const).map(({ level, title, subtitle, detail }) => (
                <label
                  key={level}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    form.cmmcLevel === level
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="cmmcLevel"
                    checked={form.cmmcLevel === level}
                    onChange={() => setForm((f) => ({ ...f, cmmcLevel: level }))}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{title}</p>
                    <p className="text-sm text-blue-700 font-medium mt-0.5">{subtitle}</p>
                    <p className="text-sm text-gray-500 mt-1">{detail}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Org Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Organization Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.orgName}
                onChange={(e) => update('orgName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Acme Defense Contractors, LLC"
              />
              {errors.orgName && <p className="text-xs text-red-500 mt-1">{errors.orgName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CAGE Code</label>
              <input
                type="text"
                value={form.cageCode}
                onChange={(e) => update('cageCode', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1AB2C"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Contact Name
              </label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => update('contactName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="jane@acmedefense.com"
              />
              {errors.contactEmail && (
                <p className="text-xs text-red-500 mt-1">{errors.contactEmail}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => update('contactPhone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        )}

        {/* Step 3: System Scoping */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">System Scoping</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.systemName}
                onChange={(e) => update('systemName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Production Network — CUI Processing"
              />
              {errors.systemName && (
                <p className="text-xs text-red-500 mt-1">{errors.systemName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Description
              </label>
              <textarea
                value={form.systemDescription}
                onChange={(e) => update('systemDescription', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                placeholder="Describe the system boundary, networks, and key components..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUI Categories</label>
              <textarea
                value={form.cuiTypes}
                onChange={(e) => update('cuiTypes', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                placeholder="e.g., Technical Data, Export Controlled, DoD Unclassified..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Users in Scope
              </label>
              <input
                type="number"
                value={form.userCount}
                onChange={(e) => update('userCount', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="25"
                min="1"
              />
            </div>
          </div>
        )}

        {/* Step 4: N/A Controls */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Mark Non-Applicable Controls</h2>
            <p className="text-sm text-gray-500">
              Select any exclusions that apply to this organization's environment. These controls
              will be marked N/A and excluded from the SPRS score.
            </p>
            <div className="space-y-3">
              {COMMON_EXCLUSIONS.map((exc) => (
                <label
                  key={exc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.exclusions.includes(exc.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.exclusions.includes(exc.id)}
                    onChange={() => toggleExclusion(exc.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{exc.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Excludes: {exc.controls.join(', ')}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Review</h2>
            <div className="space-y-3 text-sm">
              <div className="bg-blue-50 rounded-lg p-4 space-y-1 border border-blue-200">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Certification Target</p>
                <p className="text-base font-bold text-blue-900">CMMC Level {form.cmmcLevel}</p>
                <p className="text-xs text-blue-700">{form.cmmcLevel === 2 ? 'NIST SP 800-171 Rev 2 · 110 controls · SPRS scored' : 'NIST SP 800-172 · 145 controls · DIBCAC assessment'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-gray-700">Organization</h3>
                <dl className="space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-32">Name:</dt>
                    <dd className="text-gray-900">{form.orgName}</dd>
                  </div>
                  {form.cageCode && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-32">CAGE Code:</dt>
                      <dd className="text-gray-900">{form.cageCode}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-32">Contact:</dt>
                    <dd className="text-gray-900">
                      {form.contactName && `${form.contactName} — `}
                      {form.contactEmail}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-gray-700">System</h3>
                <dl className="space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-32">System Name:</dt>
                    <dd className="text-gray-900">{form.systemName}</dd>
                  </div>
                  {form.userCount && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-32">Users:</dt>
                      <dd className="text-gray-900">{form.userCount}</dd>
                    </div>
                  )}
                  {form.cuiTypes && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-32">CUI Types:</dt>
                      <dd className="text-gray-900">{form.cuiTypes}</dd>
                    </div>
                  )}
                </dl>
              </div>
              {form.exclusions.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium text-gray-700">N/A Exclusions</h3>
                  <ul className="space-y-1">
                    {form.exclusions.map((id) => {
                      const exc = COMMON_EXCLUSIONS.find((e) => e.id === id)
                      return exc ? (
                        <li key={id} className="text-gray-600">
                          {exc.label}
                        </li>
                      ) : null
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Submit */}
        {step === 6 && (
          <div className="text-center space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Ready to Onboard</h2>
            <p className="text-sm text-gray-500">
              Clicking submit will create the organization, seed all {form.cmmcLevel === 3 ? '145' : '110'} CMMC Level {form.cmmcLevel} controls, and set up the initial program. This takes a few seconds.
            </p>
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating organization…' : 'Create Organization & Seed Controls'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={back}
          disabled={step === 1}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back
        </button>
        {step < TOTAL_STEPS && (
          <button
            onClick={next}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
