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
                <main class="flex-1 overflow-y-auto">
                    <TokenBar/>
                    <div class="p-8">
                        <Routes>
                            <Route path="/" view=OverviewPage/>
                            <Route path="/modules" view=ModulesPage/>
                            <Route path="/audit" view=AuditPage/>
                            <Route path="/dry-run" view=DryRunPage/>
                            <Route path="/testing" view=TestingPage/>
                        </Routes>
                    </div>
                </main>
            </div>
        </Router>
    }
}

/// Top-of-page bar for entering the admin Bearer token. Persists to sessionStorage so
/// pages can attach it on every API call. Renders a masked-token chip when set, and an
/// input + Save button when not set. Pressing Enter in the input also saves.
#[component]
fn TokenBar() -> impl IntoView {
    let (input, set_input) = create_signal(String::new());
    let (current, set_current) = create_signal::<Option<String>>(auth::get_token());

    let save = move |_| {
        let v = input.get().trim().to_string();
        if !v.is_empty() {
            auth::set_token(&v);
            set_current.set(Some(v));
            set_input.set(String::new());
        }
    };
    let clear = move |_| {
        auth::clear_token();
        set_current.set(None);
    };

    view! {
        <div class="border-b border-slate-800 bg-slate-900/60 px-6 py-3 flex items-center gap-3">
            { move || match current.get() {
                Some(t) => {
                    let masked = mask(&t);
                    view! {
                        <span class="text-sm text-emerald-400">"\u{25CF} Authenticated"</span>
                        <span class="text-xs text-slate-500 font-mono">{masked}</span>
                        <button class="ml-auto text-xs text-slate-400 hover:text-red-400 px-3 py-1 rounded border border-slate-700"
                            on:click=clear>"Forget token"</button>
                    }.into_view()
                }
                None => {
                    view! {
                        <span class="text-sm text-amber-400">"\u{25CB} Not authenticated"</span>
                        <input type="password"
                            class="flex-1 max-w-xl rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono"
                            placeholder="Admin Bearer token"
                            prop:value=move || input.get()
                            on:input=move |ev| set_input.set(event_target_value(&ev))
                            on:keydown=move |ev| {
                                if ev.key() == "Enter" {
                                    let v = input.get().trim().to_string();
                                    if !v.is_empty() {
                                        auth::set_token(&v);
                                        set_current.set(Some(v));
                                        set_input.set(String::new());
                                    }
                                }
                            }/>
                        <button class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold"
                            on:click=save>"Save"</button>
                    }.into_view()
                }
            }}
        </div>
    }
}

fn mask(t: &str) -> String {
    if t.len() <= 12 {
        return "***".into();
    }
    let head: String = t.chars().take(6).collect();
    let tail: String = t.chars().skip(t.len() - 4).collect();
    format!("{head}…{tail}")
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
