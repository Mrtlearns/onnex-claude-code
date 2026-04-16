import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { nodes, action_logs } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { getSessionFromRequest } from '@/lib/auth'
import { nanoid } from '@/lib/nanoid'
import { z } from 'zod'

const AIQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  context_node_ids: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = AIQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { query, context_node_ids } = parsed.data

    // Fetch context nodes if provided
    let contextText = ''
    if (context_node_ids && context_node_ids.length > 0) {
      const contextNodes = await db
        .select()
        .from(nodes)
        .where(inArray(nodes.id, context_node_ids))

      contextText = contextNodes
        .map((n) => `[${n.type.toUpperCase()}] ${n.title}${n.content ? ': ' + n.content : ''}`)
        .join('\n')
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    const systemPrompt = `You are a knowledge assistant for Knowledge Universe, a personal knowledge management system.
The user has a knowledge universe of interconnected nodes — notes, tasks, ideas, references, people, and projects.
${contextText ? `\nRelevant context nodes:\n${contextText}\n` : ''}
Be concise, insightful, and help the user connect ideas and extract value from their knowledge graph.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'Knowledge Universe',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenRouter error:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
    }

    // Log the query
    await db.insert(action_logs).values({
      id: nanoid(),
      action: 'ai.query',
      entity_type: null,
      entity_id: null,
      payload: { query, context_node_ids },
    })

    // Stream the response back
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('POST /api/ai error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
