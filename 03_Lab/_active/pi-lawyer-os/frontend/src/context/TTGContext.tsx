import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface TtgLogEntry { id: number; time: string; icon: string; message: string; category: string; }

export interface TtgConfig {
  tickInterval: number;
  simDaysPerTick: number;
  durationMinutes: number;
  intensity: 'quiet' | 'normal' | 'busy';
  newLeads: boolean;
  medicalUpdates: boolean;
  settlementActivity: boolean;
  caseUpdates: boolean;
  partnerReferrals: boolean;
}

export interface TTGContextType {
  ttgRunning: boolean;
  ttgConfig: TtgConfig;
  setTtgConfig: React.Dispatch<React.SetStateAction<TtgConfig>>;
  ttgStats: { events: number; simDays: number };
  ttgLog: TtgLogEntry[];
  ttgRuntime: string;
  startTtg: (firmId: string) => void;
  stopTtg: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TTG_FIRST_NAMES = ['Kevin', 'Ashley', 'Marcus', 'Diana', 'Roberto', 'Sandra', 'Tyler', 'Melissa', 'Andre', 'Vanessa', 'Jason', 'Priya', 'Omar', 'Claire', 'Darius', 'Yolanda', 'Ethan', 'Fatima', 'Liam', 'Camille'];
const TTG_LAST_NAMES = ['Morrison', 'Fletcher', 'Okafor', 'Patel', 'Guerrero', 'Lindsey', 'Washington', 'Nakamura', 'Williams', 'Garcia', 'Johansson', 'Reyes', 'Singh', 'Kim', 'Thompson', 'Rivera', 'Chen', 'Owens', 'Martinez', 'Brooks'];
const TTG_INJURY_TYPES = ['auto', 'slip-fall', 'premises-liability', 'dog-bite', 'motorcycle', 'tbi'];
const TTG_SOURCES = ['google', 'referral', 'web-form', 'phone', 'sms', 'billboard'];
const TTG_PROVIDERS = ['Desert Orthopedics', 'Vegas Spine & Rehab', 'Sunrise Imaging MRI', 'Henderson Chiropractic', 'NV Regional Medical Center', 'Southwest PT & Rehab', 'Spring Valley ER', 'Nellis Orthopedic Group', 'Summerlin Medical Center', 'Desert Pain Management', 'Vegas Neurology Associates', 'Henderson Hand Center', 'Sunrise Hospital Trauma', 'Nathan Adelson Pain Clinic', 'LV Physical Therapy'];
const TTG_COMM_TEMPLATES: Record<string, string[]> = {
  call: ['Initial consultation call completed. Client described incident in detail.', 'Follow-up call with client re: medical appointment scheduling.', 'Called adjuster regarding pending offer — no response. Left voicemail.', 'Conference call with medical provider regarding lien reduction.'],
  sms: ['Hi {{name}}, just checking in on your recovery. Please call us with any updates.', 'Reminder: your next appointment is scheduled. Contact us with any questions.', 'We received your records. Everything looks good — expect an update this week.'],
  note: ['Medical records received and reviewed. Adding to case file.', 'Adjuster emailed — offer below threshold. Sending counter-demand.', 'Client authorized settlement negotiation range. Proceeding with counter.', 'Demand letter sent to insurance carrier. 30-day response window started.'],
  email: ['Sent demand packet to adjuster including all medical specials and wage loss documentation.', 'Follow-up email to adjuster — no response to initial demand after 14 days.'],
};
const TTG_TASK_TEMPLATES = ['Request medical records from provider', 'Follow up with adjuster on pending offer', 'Schedule client deposition prep session', 'Review and send counter-demand', 'File litigation hold letter', 'Obtain signed disbursement authorization', 'Confirm PT treatment completion date', 'Order police report from LVMPD'];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const nowStr = () => new Date().toLocaleTimeString('en-US', { hour12: false });

// ── Context ───────────────────────────────────────────────────────────────────
const TTGContext = createContext<TTGContextType | null>(null);

export function useTTG(): TTGContextType {
  const ctx = useContext(TTGContext);
  if (!ctx) throw new Error('useTTG must be used within TTGProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function TTGProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [ttgRunning, setTtgRunning] = useState(false);
  const [ttgConfig, setTtgConfig] = useState<TtgConfig>({
    tickInterval: 5,
    simDaysPerTick: 7,
    durationMinutes: 60,
    intensity: 'normal',
    newLeads: true,
    medicalUpdates: true,
    settlementActivity: true,
    caseUpdates: true,
    partnerReferrals: true,
  });
  const [ttgStats, setTtgStats] = useState({ events: 0, simDays: 0 });
  const [ttgLog, setTtgLog] = useState<TtgLogEntry[]>([]);
  const [ttgRuntime, setTtgRuntime] = useState('0m 0s');
  const ttgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttgStartRef = useRef<Date | null>(null);
  const ttgEntryId = useRef(0);
  const firmIdRef = useRef<string | null>(null);

  async function runTtgTick(currentFirmId: string, config: TtgConfig) {
    const token = getToken();
    const hdrs: Record<string, string> = { 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (token) hdrs['Authorization'] = `Bearer ${token}`;

    const intensityMap: Record<string, [number, number]> = { quiet: [1, 2], normal: [3, 5], busy: [5, 8] };
    const [minEvt, maxEvt] = intensityMap[config.intensity];
    const numEvents = Math.floor(Math.random() * (maxEvt - minEvt + 1)) + minEvt;

    const [casesRes, leadsRes] = await Promise.all([
      fetch(`${API_BASE}/cases?firm_id=eq.${currentFirmId}&status=neq.closed&select=id,client_id&limit=20`, { headers: hdrs }),
      fetch(`${API_BASE}/leads?firm_id=eq.${currentFirmId}&status=neq.lost&select=id,first_name,last_name&limit=20`, { headers: hdrs }),
    ]);
    const cases: { id: string; client_id: string }[] = casesRes.ok ? await casesRes.json() : [];
    const leads: { id: string; first_name: string; last_name: string }[] = leadsRes.ok ? await leadsRes.json() : [];

    type EventType = 'newLead' | 'leadAdvance' | 'medRecords' | 'medProvider' | 'settleOffer' | 'caseUpdate' | 'newTask' | 'taskComplete' | 'communication' | 'caseCost' | 'partnerReferral';
    const eventPool: EventType[] = [];
    if (config.newLeads) { eventPool.push('newLead', 'leadAdvance'); }
    if (config.medicalUpdates) { eventPool.push('medRecords', 'medProvider'); }
    if (config.settlementActivity && cases.length > 0) { eventPool.push('settleOffer'); }
    if (config.caseUpdates) {
      eventPool.push('newTask', 'taskComplete', 'communication', 'caseCost');
      if (cases.length > 0) eventPool.push('caseUpdate');
    }
    if (config.partnerReferrals) { eventPool.push('partnerReferral'); }
    if (eventPool.length === 0) return { entries: [] as TtgLogEntry[], events: 0 };

    const newEntries: TtgLogEntry[] = [];
    let eventsGenerated = 0;

    for (let i = 0; i < numEvents; i++) {
      const eventType = pick(eventPool);
      const time = nowStr();
      try {
        if (eventType === 'newLead') {
          const fn = pick(TTG_FIRST_NAMES); const ln = pick(TTG_LAST_NAMES);
          const injury = pick(TTG_INJURY_TYPES); const source = pick(TTG_SOURCES);
          await fetch(`${API_BASE}/leads`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, first_name: fn, last_name: ln, injury_type: injury, source, status: 'new', phone: `702-555-${String(Math.floor(1000 + Math.random() * 9000))}`, email: `${fn.toLowerCase()}.${ln.toLowerCase()}@ttg.demo` }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '👤', message: `New lead: ${fn} ${ln} (${injury.replace('-', ' ')}) via ${source}`, category: 'lead' });
          eventsGenerated++;

        } else if (eventType === 'leadAdvance' && leads.length > 0) {
          const lead = pick(leads);
          const nextStatus = pick(['contacted', 'intake-in-progress']);
          await fetch(`${API_BASE}/leads?id=eq.${lead.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ status: nextStatus }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '📋', message: `Lead ${lead.first_name} ${lead.last_name} advanced to ${nextStatus}`, category: 'lead' });
          eventsGenerated++;

        } else if (eventType === 'medRecords' && cases.length > 0) {
          const c = pick(cases);
          const provName = pick(TTG_PROVIDERS);
          const medRes = await fetch(`${API_BASE}/medical_providers?case_id=eq.${c.id}&request_status=eq.requested&select=id&limit=5`, { headers: hdrs });
          const medProvs: { id: string }[] = medRes.ok ? await medRes.json() : [];
          if (medProvs.length > 0) {
            const mp = pick(medProvs);
            await fetch(`${API_BASE}/medical_providers?id=eq.${mp.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ request_status: 'received', lien_amount: Math.floor(3000 + Math.random() * 20000), received_at: new Date().toISOString() }) });
            newEntries.push({ id: ++ttgEntryId.current, time, icon: '🏥', message: `Medical records received from ${provName}`, category: 'medical' });
            eventsGenerated++;
          }

        } else if (eventType === 'medProvider' && cases.length > 0) {
          const c = pick(cases); const provName = pick(TTG_PROVIDERS);
          await fetch(`${API_BASE}/medical_providers`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, case_id: c.id, name: provName, provider_type: pick(['orthopedic', 'chiropractic', 'physical_therapy', 'hospital', 'radiology']), request_status: 'requested', lien_amount: 0 }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '📋', message: `New provider requested: ${provName}`, category: 'medical' });
          eventsGenerated++;

        } else if (eventType === 'settleOffer' && cases.length > 0) {
          const c = pick(cases);
          const isDefense = Math.random() > 0.5;
          const amount = Math.floor(20000 + Math.random() * 120000);
          await fetch(`${API_BASE}/settlement_offers`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, case_id: c.id, offer_by: isDefense ? 'defense' : 'plaintiff', amount, offered_at: new Date().toISOString(), accepted: false, notes: isDefense ? `Insurance offer of $${amount.toLocaleString()}` : `Counter-demand of $${amount.toLocaleString()} submitted` }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '💰', message: `${isDefense ? 'Defense offer' : 'Counter-demand'} $${amount.toLocaleString()} on case`, category: 'settle' });
          eventsGenerated++;

        } else if (eventType === 'caseUpdate' && cases.length > 0) {
          const c = pick(cases);
          const nextStatus = pick(['investigation', 'demand', 'negotiation', 'settlement']);
          await fetch(`${API_BASE}/cases?id=eq.${c.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ status: nextStatus }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '⚖️', message: `Case status advanced to ${nextStatus}`, category: 'case' });
          eventsGenerated++;

        } else if (eventType === 'newTask' && cases.length > 0) {
          const c = pick(cases); const title = pick(TTG_TASK_TEMPLATES);
          const dueDate = new Date(Date.now() + Math.floor(7 + Math.random() * 21) * 86400000).toISOString();
          await fetch(`${API_BASE}/tasks`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, case_id: c.id, title, task_type: 'general', due_date: dueDate, status: 'open' }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '✅', message: `Task created: ${title}`, category: 'task' });
          eventsGenerated++;

        } else if (eventType === 'taskComplete') {
          const taskRes = await fetch(`${API_BASE}/tasks?firm_id=eq.${currentFirmId}&status=eq.open&select=id,title&limit=10`, { headers: hdrs });
          const openTasks: { id: string; title: string }[] = taskRes.ok ? await taskRes.json() : [];
          if (openTasks.length > 0) {
            const t = pick(openTasks);
            await fetch(`${API_BASE}/tasks?id=eq.${t.id}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ status: 'completed' }) });
            newEntries.push({ id: ++ttgEntryId.current, time, icon: '✔️', message: `Task completed: ${t.title.slice(0, 55)}`, category: 'task' });
            eventsGenerated++;
          }

        } else if (eventType === 'communication' && leads.length > 0) {
          const lead = pick(leads);
          const channel = pick(['call', 'sms', 'note', 'email']);
          const templates = TTG_COMM_TEMPLATES[channel];
          const message = pick(templates).replace('{{name}}', lead.first_name);
          await fetch(`${API_BASE}/communications`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, lead_id: lead.id, channel, direction: 'outbound', message, status: 'sent' }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '💬', message: `[${channel}] ${message.slice(0, 60)}`, category: 'comm' });
          eventsGenerated++;

        } else if (eventType === 'caseCost' && cases.length > 0) {
          const c = pick(cases);
          const costType = pick(['filing_fee', 'expert_fee', 'investigation', 'medical_lien']);
          const amount = Math.floor(200 + Math.random() * 5000);
          await fetch(`${API_BASE}/case_costs`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, case_id: c.id, cost_type: costType, description: `${costType.replace('_', ' ')} — generated`, amount, paid: Math.random() > 0.5 }) });
          newEntries.push({ id: ++ttgEntryId.current, time, icon: '💵', message: `Case cost: ${costType} $${amount.toLocaleString()}`, category: 'cost' });
          eventsGenerated++;

        } else if (eventType === 'partnerReferral') {
          const partnerRes = await fetch(`${API_BASE}/partners?firm_id=eq.${currentFirmId}&select=id,name&limit=10`, { headers: hdrs });
          const partners: { id: string; name: string }[] = partnerRes.ok ? await partnerRes.json() : [];
          const fn = pick(TTG_FIRST_NAMES); const ln = pick(TTG_LAST_NAMES);
          const injury = pick(TTG_INJURY_TYPES);
          const newLeadRes = await fetch(`${API_BASE}/leads`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, first_name: fn, last_name: ln, injury_type: injury, source: 'referral', status: 'new', phone: `702-555-${String(Math.floor(1000 + Math.random() * 9000))}`, email: `${fn.toLowerCase()}.${ln.toLowerCase()}@ref.demo` }) });
          if (newLeadRes.ok && partners.length > 0) {
            const leadData = await newLeadRes.json();
            const partner = pick(partners);
            await fetch(`${API_BASE}/partner_referrals`, { method: 'POST', headers: hdrs, body: JSON.stringify({ firm_id: currentFirmId, partner_id: partner.id, lead_id: leadData[0]?.id, commission_pct: 0, commission_amount: 0, commission_paid: false, notes: 'TTG simulation referral' }) });
            newEntries.push({ id: ++ttgEntryId.current, time, icon: '🤝', message: `Partner referral from ${partner.name}: ${fn} ${ln}`, category: 'partner' });
            eventsGenerated++;
          }
        }
      } catch {
        // Silently ignore individual event errors
      }
    }
    return { entries: newEntries, events: eventsGenerated };
  }

  function stopTtg() {
    if (ttgIntervalRef.current) {
      clearInterval(ttgIntervalRef.current);
      ttgIntervalRef.current = null;
    }
    setTtgRunning(false);
  }

  function startTtg(firmId: string) {
    if (ttgRunning) return;
    if (ttgIntervalRef.current) clearInterval(ttgIntervalRef.current);
    firmIdRef.current = firmId;
    ttgStartRef.current = new Date();
    setTtgRunning(true);
    setTtgStats({ events: 0, simDays: 0 });
    setTtgLog([]);
    ttgEntryId.current = 0;

    const capturedConfig = { ...ttgConfig };
    ttgIntervalRef.current = setInterval(async () => {
      const token = getToken();
      if (!token) { stopTtg(); return; }
      if (!firmIdRef.current) return;
      if (capturedConfig.durationMinutes > 0 && ttgStartRef.current) {
        const elapsedMs = Date.now() - ttgStartRef.current.getTime();
        if (elapsedMs >= capturedConfig.durationMinutes * 60 * 1000) {
          stopTtg();
          return;
        }
      }
      const result = await runTtgTick(firmIdRef.current, capturedConfig);
      if (result.entries.length > 0) {
        setTtgLog(prev => [...result.entries, ...prev].slice(0, 25));
        setTtgStats(prev => ({ events: prev.events + result.events, simDays: prev.simDays + capturedConfig.simDaysPerTick }));
        queryClient.invalidateQueries({ queryKey: ['activity_feed'] });
      }
    }, capturedConfig.tickInterval * 1000);
  }

  useEffect(() => {
    return () => { if (ttgIntervalRef.current) clearInterval(ttgIntervalRef.current); };
  }, []);

  useEffect(() => {
    if (!ttgRunning) return;
    const runtimeInterval = setInterval(() => {
      if (!ttgStartRef.current) return;
      const elapsed = Math.floor((Date.now() - ttgStartRef.current.getTime()) / 1000);
      setTtgRuntime(`${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    }, 1000);
    return () => clearInterval(runtimeInterval);
  }, [ttgRunning]);

  return (
    <TTGContext.Provider value={{ ttgRunning, ttgConfig, setTtgConfig, ttgStats, ttgLog, ttgRuntime, startTtg, stopTtg }}>
      {children}
    </TTGContext.Provider>
  );
}
