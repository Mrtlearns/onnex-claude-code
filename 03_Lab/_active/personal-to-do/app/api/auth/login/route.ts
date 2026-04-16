import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, signToken, buildSessionCookie } from '@/lib/auth'
import { z } from 'zod'

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = LoginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { username, password } = parsed.data
    const valid = await validateCredentials(username, password)

    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await signToken({ username, role: 'admin' })
    const cookie = buildSessionCookie(token)

    const response = NextResponse.json({ ok: true })
    response.headers.set('Set-Cookie', cookie)
    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
