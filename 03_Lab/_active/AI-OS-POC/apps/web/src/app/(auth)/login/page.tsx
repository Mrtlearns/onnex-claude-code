// apps/web/src/app/(auth)/login/page.tsx
// Public login page — triggers Authentik OIDC via next-auth signIn

import { signIn } from "@/auth"

export default function LoginPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem" }}>
        Agency AI-OS
      </h1>
      <form
        action={async () => {
          "use server"
          await signIn("authentik", { redirectTo: "/" })
        }}
      >
        <button
          type="submit"
          style={{
            padding: "0.75rem 2rem",
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Sign in with Authentik
        </button>
      </form>
    </main>
  )
}
