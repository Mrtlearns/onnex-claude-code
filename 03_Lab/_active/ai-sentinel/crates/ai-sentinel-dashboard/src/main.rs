//! AI-Sentinel dashboard — Leptos CSR.
//!
//! Phase 5 scope: list modules, toggle enable/disable, inspect versions, audit log,
//! rules dry-run. All state is fetched from `/admin/*` with a Bearer token the admin
//! enters once and we hold in sessionStorage.
//!
//! Build: `trunk build --release` from this crate directory. Output → `dist/`, then
//! copied into `../ai-sentinel-api/static/dashboard/` (Makefile handles this in Wave 9+).

use leptos::*;
use leptos_router::*;
use serde::{Deserialize, Serialize};

mod api;
mod auth;
mod pages;

use pages::{AuditPage, DryRunPage, ModulesPage, OverviewPage, TestingPage};

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(App);
}

#[component]
fn App() -> impl IntoView {
    view! {
        <Router>
            <div class="flex min-h-screen">
                <Sidebar/>
                <main class="flex-1 p-8 overflow-y-auto">
                    <Routes>
                        <Route path="/" view=OverviewPage/>
                        <Route path="/modules" view=ModulesPage/>
                        <Route path="/audit" view=AuditPage/>
                        <Route path="/dry-run" view=DryRunPage/>
                        <Route path="/testing" view=TestingPage/>
                    </Routes>
                </main>
            </div>
        </Router>
    }
}

#[component]
fn Sidebar() -> impl IntoView {
    view! {
        <aside class="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-2">
            <h1 class="text-xl font-semibold mb-6">"AI-Sentinel"</h1>
            <A href="/" class="nav-link">"Overview"</A>
            <A href="/modules" class="nav-link">"Modules"</A>
            <A href="/audit" class="nav-link">"Audit"</A>
            <A href="/dry-run" class="nav-link">"Dry-run"</A>
            <A href="/testing" class="nav-link">"Testing"</A>
        </aside>
    }
}
