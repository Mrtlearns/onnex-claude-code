import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("App crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "system-ui" }}>
          <h1 style={{ color: "#dc2626" }}>Something went wrong</h1>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12, color: "#666" }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
