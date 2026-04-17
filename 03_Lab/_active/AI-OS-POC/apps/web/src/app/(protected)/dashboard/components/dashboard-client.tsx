"use client"
// apps/web/src/app/(protected)/dashboard/components/dashboard-client.tsx
// Client wrapper — composes KpiCards, ActivityFeed, QuickActions, TeamWorkload

import { motion, type Variants } from "framer-motion"
import type { Session } from "next-auth"
import { KpiCards } from "./kpi-cards"
import { ActivityFeed } from "./activity-feed"
import { QuickActions } from "./quick-actions"
import { TeamWorkload } from "./team-workload"

interface DashboardClientProps {
  session: Session | null
}

const container: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

export function DashboardClient({ session }: DashboardClientProps) {
  return (
    <motion.div
      className="flex flex-col gap-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <KpiCards />
      </motion.div>

      <motion.div
        className="grid lg:grid-cols-[1fr_300px] gap-6"
        variants={item}
      >
        <ActivityFeed />
        <div className="flex flex-col gap-4">
          <QuickActions />
          <TeamWorkload session={session} />
        </div>
      </motion.div>
    </motion.div>
  )
}
