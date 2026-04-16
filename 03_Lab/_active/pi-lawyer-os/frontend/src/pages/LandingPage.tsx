import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  PhoneOff,
  Clock,
  UserX,
  Network,
  Zap,
  Shield,
  RefreshCw,
  Users,
  BarChart3,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  Bot,
  DollarSign,
  TrendingUp,
  FileText,
} from 'lucide-react';

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const NAV_LINKS = [
  { label: 'The Problem', href: '#problem' },
  { label: 'The System', href: '#solution' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Results', href: '#results' },
];

const PAIN_CARDS = [
  {
    icon: PhoneOff,
    title: 'Missed Calls = Missed Cases',
    body: "The average PI firm misses 47% of inbound calls during business hours. Every unanswered ring is a case walking straight to your competitor.",
    stat: '47%',
    statLabel: 'of calls go unanswered',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Clock,
    title: "You're Responding Too Late",
    body: '62% of personal injury cases are signed by the first firm to respond. Your intake team is working hard — but they\'re losing the race against the clock.',
    stat: '62%',
    statLabel: 'of cases go to the first responder',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: UserX,
    title: "Dead Leads Aren't Dead",
    body: "The average PI firm has 3–5 years of old leads sitting untouched. 47% of them are still viable cases — they just never got the right follow-up at the right time.",
    stat: '$240K',
    statLabel: 'avg recoverable revenue per year',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: Network,
    title: 'Your Referral Engine Is Broken',
    body: "Referrals drive 60–70% of PI revenue. Yet most firms track them in spreadsheets — or not at all. No system. No automation. No flywheel.",
    stat: '60–70%',
    statLabel: 'of PI revenue comes from referrals',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
];

const PHASE1_FEATURES = [
  {
    icon: Zap,
    label: 'Speed-to-Lead Automation',
    desc: 'Auto-respond to every inbound within 60 seconds — 24/7/365',
  },
  {
    icon: PhoneOff,
    label: 'Missed Call Recovery',
    desc: 'Every unanswered call triggers an immediate SMS + email recovery sequence',
  },
  {
    icon: FileText,
    label: 'Intake Automation',
    desc: 'Guided digital intake that collects everything you need — no phone tag',
  },
  {
    icon: CheckCircle,
    label: 'Retainer Follow-Up',
    desc: 'Automated nudge sequences that move signed clients through onboarding',
  },
  {
    icon: BarChart3,
    label: 'Revenue Dashboard',
    desc: 'Real-time visibility into every lead, case, and dollar in your pipeline',
  },
];

const PHASE2_FEATURES = [
  {
    icon: RefreshCw,
    label: 'Lead Resurrection',
    desc: 'AI re-engages cold leads from the last 3–5 years with personalized outreach',
  },
  {
    icon: Users,
    label: 'Referral Flywheel',
    desc: 'Automated referral tracking, partner nurture, and thank-you workflows',
  },
  {
    icon: TrendingUp,
    label: 'Review-to-Case Engine',
    desc: 'Convert 5-star reviews into new case inquiries automatically',
  },
  {
    icon: Network,
    label: 'Partner Networks',
    desc: 'Build and automate relationships with chiropractors, ERs, and body shops',
  },
  {
    icon: DollarSign,
    label: 'Revenue Share Model',
    desc: "We grow when you grow. Aligned incentives — no risk, pure upside.",
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Revenue Audit (Week 1)',
    desc: "We map every revenue leak in your firm — missed calls, cold leads, broken intake, dead referral channels. You'll see the exact dollar amount you're losing before we build anything.",
  },
  {
    step: '02',
    title: 'Phase 1 Deployment (Days 30–60)',
    desc: 'We build and launch your Revenue Protection System. Speed-to-lead, missed call recovery, intake automation, and retainer follow-ups — all live and working.',
  },
  {
    step: '03',
    title: 'Phase 2 Growth Engine (Day 90+)',
    desc: 'Once revenue is protected, we activate growth. Old lead resurrection, referral flywheel, review conversion, and partner network automation.',
  },
];

const FAQS = [
  {
    q: 'What does Phase 1 cost?',
    a: 'Phase 1 is a $40,000 build investment plus $4,000/month in platform and support fees. Most firms recover the full build cost within the first 90 days from recovered cases alone.',
  },
  {
    q: 'How long does deployment take?',
    a: 'Phase 1 goes live within 30–60 days. We handle all technical setup, integrations, and staff training. Your team is operational before we finish.',
  },
  {
    q: 'Do we need to change our existing software?',
    a: "No. PI Growth OS integrates with your existing case management, phone system, and CRM. We add a layer on top — we don't replace what's working.",
  },
  {
    q: "What if we don't see results?",
    a: 'We offer a performance guarantee on Phase 1. If we don\'t recover the build cost in verified new cases within 90 days, we continue working at no additional charge until we do.',
  },
  {
    q: 'How is Phase 2 priced?',
    a: 'Phase 2 runs on a revenue share model. We take a percentage of revenue generated from resurrected leads, referral conversions, and growth engine results. No upfront cost.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleEnterPlatform = () => navigate('/app');
  const handleBookAudit = () => navigate('/app');

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg tracking-tight">PI Growth OS</span>
              <span className="hidden sm:block text-slate-500 text-xs ml-1">by Onnex</span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-slate-300 hover:text-white text-sm transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleEnterPlatform}
                className="hidden sm:flex items-center gap-1 text-slate-300 hover:text-white text-sm transition-colors"
              >
                Enter Platform <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleBookAudit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Get Free Audit
              </button>
              <button
                className="md:hidden text-slate-300"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-white/5 px-4 py-4 space-y-3">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="block text-slate-300 hover:text-white text-sm py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={handleEnterPlatform}
              className="block text-slate-300 hover:text-white text-sm py-1"
            >
              Enter Platform →
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-slate-900 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6"
            >
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
              AI-Native Operating System — Built Exclusively for PI Law Firms
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
            >
              Your Firm Is Losing{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                $400K+ a Year.
              </span>{' '}
              We'll Show You Exactly Where.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-slate-300 mb-10 leading-relaxed"
            >
              PI Growth OS is the AI operating system built exclusively for personal injury law firms —
              protecting every lead, automating every follow-up, and turning your cold pipeline
              into signed clients. Built and deployed by Onnex in 30–60 days.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mb-12"
            >
              <button
                onClick={handleBookAudit}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
              >
                Get Your Free Revenue Leak Audit
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleEnterPlatform}
                className="flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white font-medium px-8 py-4 rounded-xl text-base transition-all hover:bg-white/5"
              >
                Enter Platform
                <ArrowRight className="w-4 h-4 opacity-60" />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap gap-6 text-slate-400 text-sm"
            >
              {[
                'No long-term contracts',
                '30–60 day deployment',
                '90-day performance guarantee',
              ].map(label => (
                <span key={label} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  {label}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative mt-20 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '47%', label: 'of PI leads never get called back' },
                { value: '< 5 min', label: 'required response time to win cases' },
                { value: '62%', label: 'of cases go to the first firm to respond' },
                { value: '3–5 yrs', label: 'of recoverable leads sitting in your CRM' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{value}</div>
                  <div className="text-slate-400 text-sm">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section id="problem" className="bg-slate-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-block bg-red-500/10 text-red-400 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              The Problem
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              4 Silent Revenue Killers Hiding in Your Firm
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Most PI firms don't have a marketing problem. They have a revenue leakage problem.
              The leads are coming in — they're just falling through the cracks.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PAIN_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <FadeIn key={card.title} delay={i * 0.1}>
                  <div className="bg-slate-900 rounded-2xl p-6 border border-white/5 h-full">
                    <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <h3 className="text-white font-semibold text-lg mb-2">{card.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{card.body}</p>
                    <div className="border-t border-white/5 pt-4">
                      <div className={`text-2xl font-bold ${card.color}`}>{card.stat}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{card.statLabel}</div>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section id="solution" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              The System
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Two Phases. One Operating System.
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              We don't try to do everything at once. Phase 1 seals the revenue leaks.
              Phase 2 builds the growth engine. Trust is earned before scale begins.
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Phase 1 */}
            <FadeIn delay={0.1}>
              <div className="bg-slate-900 rounded-2xl p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Phase 1</div>
                    <h3 className="text-white font-bold text-xl">Revenue Protection</h3>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-white font-bold">$40K</div>
                    <div className="text-slate-400 text-xs">+ $4K/mo</div>
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Stop the bleeding first. Every missed call, slow intake, and forgotten follow-up
                  gets automated. Revenue you're already generating but losing gets protected.
                </p>
                <ul className="space-y-3">
                  {PHASE1_FEATURES.map(({ icon: Icon, label, desc }) => (
                    <li key={label} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-indigo-600/20 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{label}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            {/* Phase 2 */}
            <FadeIn delay={0.2}>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-indigo-200 font-semibold uppercase tracking-wider">Phase 2</div>
                    <h3 className="text-white font-bold text-xl">Revenue Growth</h3>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-white font-bold">Rev Share</div>
                    <div className="text-indigo-200 text-xs">No upfront cost</div>
                  </div>
                </div>
                <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                  Once the foundation is solid, we activate the growth engine. Old leads resurrected.
                  Referral flywheels automated. Revenue share means we only win when you win.
                </p>
                <ul className="space-y-3">
                  {PHASE2_FEATURES.map(({ icon: Icon, label, desc }) => (
                    <li key={label} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{label}</div>
                        <div className="text-indigo-200 text-xs mt-0.5">{desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-block bg-emerald-50 text-emerald-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              Process
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              From Audit to Live in 30–60 Days
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              No 12-month implementation. No IT department required.
              We handle everything — build, deploy, train, and support.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <FadeIn key={step.step} delay={i * 0.15}>
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm h-full">
                  <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-6">
                    <span className="text-white font-bold text-sm">{step.step}</span>
                  </div>
                  <h3 className="text-slate-900 font-bold text-lg mb-3">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      <section id="results" className="bg-slate-900 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <div className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              Results
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              What PI Firms See After Phase 1
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Real outcomes from the PI Growth OS Revenue Protection System.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { value: '< 60s', label: 'Average lead response time (was 2–4 hrs)', color: 'text-emerald-400' },
              { value: '3.2×', label: 'Increase in intake completion rate', color: 'text-indigo-400' },
              { value: '$180K', label: 'Average revenue recovered in Year 1 from Phase 1 alone', color: 'text-purple-400' },
              { value: '90 days', label: 'Average time to recover the Phase 1 build investment', color: 'text-yellow-400' },
            ].map(({ value, label, color }, i) => (
              <FadeIn key={label} delay={i * 0.1}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <div className={`text-4xl font-bold ${color} mb-2`}>{value}</div>
                  <div className="text-slate-400 text-sm leading-snug">{label}</div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3}>
            <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-8 text-center">
              <p className="text-white text-xl font-semibold mb-2">
                "The system paid for itself in the first 90 days.
                We recovered 14 cases we would have lost completely."
              </p>
              <p className="text-slate-400 text-sm">— Managing Partner, 8-attorney PI firm, Las Vegas NV</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <div className="inline-block bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
                Who This Is For
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Built for PI Firms That Are Ready to Stop Leaving Money on the Table
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                PI Growth OS is purpose-built for personal injury practices.
                If you're running a 5–20 attorney firm and you know you're losing
                cases you should be winning — this is for you.
              </p>
              <ul className="space-y-3">
                {[
                  "You're a PI firm with 5–20 attorneys",
                  "You're getting leads but losing them before intake",
                  "Your team answers calls — but not fast enough",
                  "You have years of old leads with no system to re-engage them",
                  "Referrals are your top source but you have no referral system",
                  "You want AI doing the follow-up, not more headcount",
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-slate-700">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                <h3 className="text-slate-900 font-bold text-lg mb-4">This is NOT for you if:</h3>
                <ul className="space-y-3 mb-8">
                  {[
                    "You're a solo practitioner (under 2 attorneys)",
                    "You're not a personal injury practice",
                    "You're not willing to commit to a 90-day deployment",
                    "You expect results without any internal cooperation",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-slate-500 text-sm">
                      <span className="text-slate-300 font-bold flex-shrink-0 mt-0.5">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-200 pt-6">
                  <p className="text-slate-500 text-sm mb-4">
                    Right fit? Let's find out exactly how much revenue is leaking from your firm right now.
                  </p>
                  <button
                    onClick={handleBookAudit}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    Get Your Free Revenue Leak Audit
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Common Questions</h2>
            <p className="text-slate-500">Everything you want to know before your audit call.</p>
          </FadeIn>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-medium text-slate-900 text-sm pr-4">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-slate-500 text-sm leading-relaxed border-t border-slate-50 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-indigo-600 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              See Exactly Where Your Firm Is Losing Revenue
            </h2>
            <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto">
              Free 45-minute Revenue Leak Audit. We'll map your firm's exact gaps —
              missed calls, dead leads, broken intake — and give you the dollar number.
              No pitch. Just data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleBookAudit}
                className="flex items-center justify-center gap-2 bg-white text-indigo-600 font-bold px-10 py-4 rounded-xl hover:bg-indigo-50 transition-colors text-base shadow-lg"
              >
                Get Your Free Revenue Leak Audit
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleEnterPlatform}
                className="flex items-center justify-center gap-2 border border-white/30 text-white font-medium px-8 py-4 rounded-xl hover:bg-white/10 transition-colors text-base"
              >
                Already a client? Enter Platform →
              </button>
            </div>
            <p className="text-indigo-200 text-sm mt-6">
              45 minutes · No commitment · Delivered by Onnex AI
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-white font-bold">PI Growth OS</span>
              <span className="text-slate-500 text-sm">by Onnex AI</span>
            </div>
            <div className="flex items-center gap-6 text-slate-500 text-sm">
              <a href="#problem" className="hover:text-white transition-colors">The Problem</a>
              <a href="#solution" className="hover:text-white transition-colors">The System</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <button onClick={handleEnterPlatform} className="hover:text-white transition-colors">
                Enter Platform
              </button>
            </div>
            <p className="text-slate-600 text-xs">© 2026 Onnex AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
