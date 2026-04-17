"use client"
// Wraps each page with a consistent padding + fade-in animation

import { motion } from "framer-motion"

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex-1 overflow-auto p-6"
    >
      {children}
    </motion.div>
  )
}
