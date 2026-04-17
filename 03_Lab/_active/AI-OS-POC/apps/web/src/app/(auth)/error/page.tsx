// apps/web/src/app/(auth)/error/page.tsx
// Auth error display page — shows error from searchParams

interface ErrorPageProps {
  searchParams: { error?: string }
}

export default function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const error = searchParams?.error ?? "Unknown error"

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    OAuthCallback: "There was a problem with the OAuth callback. Please try again.",
    OAuthCreateAccount: "Could not create an account with the provider.",
    OAuthSignin: "Could not start the sign-in flow with the provider.",
    SessionRequired: "Please sign in to access this page.",
  }

  const message = errorMessages[error] ?? `An authentication error occurred: ${error}`

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
      <div
        style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "0.5rem",
          padding: "1.5rem 2rem",
          maxWidth: "400px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#dc2626", marginBottom: "0.75rem" }}>
          Authentication Error
        </h1>
        <p style={{ color: "#374151", marginBottom: "1.5rem" }}>{message}</p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "0.5rem 1.5rem",
            background: "#4f46e5",
            color: "#fff",
            borderRadius: "0.375rem",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Back to Sign In
        </a>
      </div>
    </main>
  )
}
