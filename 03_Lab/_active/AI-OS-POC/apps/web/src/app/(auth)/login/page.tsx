// apps/web/src/app/(auth)/login/page.tsx
// Public login page — triggers Authentik OIDC via next-auth signIn

import { signIn } from "@/auth"
import { Bot } from "lucide-react"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Agency AI-OS
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your workspace
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form
            action={async () => {
              "use server"
              await signIn("authentik", { redirectTo: "/" })
            }}
          >
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Continue with Authentik
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Single sign-on via your organization&apos;s identity provider
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Onnex AI Agency &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
