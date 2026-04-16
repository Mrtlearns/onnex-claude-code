import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { nodes, edges } from '../db/schema'
import * as dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(process.cwd(), '.env') })

const client = postgres(process.env.DATABASE_URL!, { prepare: false })
const db = drizzle(client)

// nanoid-compatible generator for seed
function id(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 21; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function seed() {
  console.log('🌱 Seeding Knowledge Universe...')

  const nodeData = [
    {
      id: id(),
      title: 'Onnex AI Agency Strategy',
      content: 'Core strategy for building vertical AI-OS products across NDT, medical, MSP, and PI law verticals.',
      type: 'project',
      status: 'fresh' as const,
      x: 0, y: 0, z: 0,
      tags: ['strategy', 'onnex', 'ai'],
      last_accessed_at: daysAgo(1),
      is_public: false,
    },
    {
      id: id(),
      title: 'PI Lawyer OS Product Spec',
      content: 'Personal Injury law firm OS — intake, case management, document AI, settlement tracking, billing.',
      type: 'reference',
      status: 'fresh' as const,
      x: 200, y: -100, z: 50,
      tags: ['product', 'pi-law', 'spec'],
      last_accessed_at: daysAgo(3),
      is_public: false,
    },
    {
      id: id(),
      title: 'Research: LLM inference on Proxmox',
      content: 'Notes on running local LLM inference. Ollama + llama.cpp. GPU passthrough for RTX 4090.',
      type: 'idea',
      status: 'aging' as const,
      x: -200, y: 150, z: 100,
      tags: ['research', 'llm', 'proxmox', 'homelab'],
      last_accessed_at: daysAgo(14),
      is_public: false,
    },
    {
      id: id(),
      title: 'n8n Automation Workflows',
      content: 'Collection of n8n workflow patterns for AI-OS integrations. Webhook → AI → database patterns.',
      type: 'note',
      status: 'urgent' as const,
      x: 100, y: 200, z: -150,
      tags: ['n8n', 'automation', 'workflows'],
      last_accessed_at: daysAgo(45),
      is_public: false,
    },
    {
      id: id(),
      title: 'SAP GRC Module Notes',
      content: 'Access control, risk analysis, and compliance documentation for SAP GRC implementations.',
      type: 'reference',
      status: 'catchall' as const,
      x: -150, y: -200, z: -100,
      tags: ['sap', 'grc', 'compliance'],
      last_accessed_at: daysAgo(120),
      is_public: false,
    },
    {
      id: id(),
      title: 'Knowledge Universe POC',
      content: 'This app! A glassmorphic knowledge management tool with 3D sphere universe visualization.',
      type: 'project',
      status: 'fresh' as const,
      x: 250, y: 100, z: -200,
      tags: ['poc', 'nextjs', 'visualization'],
      last_accessed_at: daysAgo(0),
      is_public: false,
    },
  ]

  // Insert nodes
  const now = new Date()
  for (const node of nodeData) {
    await db.insert(nodes).values({
      ...node,
      metadata: {},
      archived: false,
      created_at: now,
      updated_at: now,
    }).onConflictDoNothing()
  }

  console.log(`✅ Inserted ${nodeData.length} nodes`)

  // Insert edges connecting them
  const edgeData = [
    {
      id: id(),
      source_id: nodeData[0].id,
      target_id: nodeData[1].id,
      label: 'part of',
      type: 'part_of' as const,
      strength: 0.9,
    },
    {
      id: id(),
      source_id: nodeData[0].id,
      target_id: nodeData[5].id,
      label: 'spawned',
      type: 'caused_by' as const,
      strength: 0.7,
    },
    {
      id: id(),
      source_id: nodeData[2].id,
      target_id: nodeData[0].id,
      label: 'enables',
      type: 'relates_to' as const,
      strength: 0.6,
    },
    {
      id: id(),
      source_id: nodeData[3].id,
      target_id: nodeData[1].id,
      label: 'used in',
      type: 'part_of' as const,
      strength: 0.8,
    },
    {
      id: id(),
      source_id: nodeData[4].id,
      target_id: nodeData[0].id,
      label: 'expertise',
      type: 'relates_to' as const,
      strength: 0.5,
    },
  ]

  for (const edge of edgeData) {
    await db.insert(edges).values({
      ...edge,
      created_at: now,
    }).onConflictDoNothing()
  }

  console.log(`✅ Inserted ${edgeData.length} edges`)
  console.log('🎉 Seed complete!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
