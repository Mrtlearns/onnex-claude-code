//! Dashboard pages. Minimal Phase 5 implementations — lists, toggles, and forms.
//! Polish, loading spinners, and inline YAML editing will ship in a follow-up.

use crate::api;
use leptos::*;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Module {
    pub id: i64,
    pub kind: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub current_version: i32,
    pub license_tier: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListResp {
    pub modules: Vec<Module>,
}

// ─── Overview ───────────────────────────────────────────────────────────────

#[component]
pub fn OverviewPage() -> impl IntoView {
    view! {
        <div>
            <h2 class="text-2xl font-semibold mb-4">"Overview"</h2>
            <p class="text-slate-400">"AI-Sentinel v5.0 — Modular platform. Use the sidebar to manage modules or audit history."</p>
        </div>
    }
}

// ─── Modules list + toggle ──────────────────────────────────────────────────

#[component]
pub fn ModulesPage() -> impl IntoView {
    let modules = create_resource(|| (), |_| async move {
        api::get::<ListResp>("/admin/modules").await
    });

    view! {
        <h2 class="text-2xl font-semibold mb-4">"Modules"</h2>
        <Suspense fallback=move || view!{ <p>"Loading…"</p> }>
            {move || match modules.get() {
                Some(Ok(resp)) => view! {
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <For
                            each=move || resp.modules.clone()
                            key=|m| m.id
                            children=move |m| view! { <ModuleCard module=m/> }
                        />
                    </div>
                }.into_view(),
                Some(Err(e)) => view!{ <p class="text-red-400">{format!("Error: {e}")}</p> }.into_view(),
                None => ().into_view(),
            }}
        </Suspense>
    }
}

#[component]
fn ModuleCard(module: Module) -> impl IntoView {
    let (enabled, set_enabled) = create_signal(module.enabled);
    let id = module.id;
    let name = module.name.clone();
    let kind = module.kind.clone();
    let tier = module.license_tier.clone();

    let toggle = create_action(move |b: &bool| {
        let b = *b;
        async move {
            let path = if b {
                format!("/admin/modules/{id}/enable")
            } else {
                format!("/admin/modules/{id}/disable")
            };
            let _ = api::post_empty::<serde_json::Value>(&path).await;
        }
    });

    view! {
        <div class="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div class="flex items-center justify-between">
                <div>
                    <div class="font-semibold">{name.clone()}</div>
                    <div class="text-xs text-slate-400">{format!("kind={} tier={}", kind, tier)}</div>
                </div>
                <label class="inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer"
                        prop:checked=move || enabled.get()
                        on:change=move |ev| {
                            let v = event_target_checked(&ev);
                            set_enabled.set(v);
                            toggle.dispatch(v);
                        }
                    />
                    <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:bg-white after:rounded-full after:h-5 after:w-5 after:translate-x-0.5 after:translate-y-0.5 peer-checked:after:translate-x-5 relative transition-all"></div>
                </label>
            </div>
            <p class="text-sm text-slate-400 mt-3">{module.description.clone()}</p>
            <p class="text-xs text-slate-500 mt-2">{format!("version v{}", module.current_version)}</p>
        </div>
    }
}

// ─── Audit log ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AuditEntry {
    pub id: i64,
    pub action: String,
    pub actor: String,
    pub timestamp: Option<String>,
    pub before_version: Option<i32>,
    pub after_version: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuditResp {
    pub audit: Vec<AuditEntry>,
}

#[component]
pub fn AuditPage() -> impl IntoView {
    // For Phase 5, surface the global verify endpoint result + link to module audits.
    let verify = create_resource(|| (), |_| async move {
        api::get::<serde_json::Value>("/admin/audit/verify").await
    });
    view! {
        <h2 class="text-2xl font-semibold mb-4">"Audit"</h2>
        <Suspense fallback=move || view!{ <p>"Loading…"</p> }>
            {move || match verify.get() {
                Some(Ok(v)) => view!{
                    <pre class="rounded bg-slate-900 border border-slate-800 p-4 overflow-x-auto text-sm">
                        {serde_json::to_string_pretty(&v).unwrap_or_default()}
                    </pre>
                }.into_view(),
                Some(Err(e)) => view!{ <p class="text-red-400">{format!("Error: {e}")}</p> }.into_view(),
                None => ().into_view(),
            }}
        </Suspense>
    }
}

// ─── Dry-run ─────────────────────────────────────────────────────────────────

#[component]
pub fn DryRunPage() -> impl IntoView {
    let (yaml, set_yaml) = create_signal(String::new());
    let (content, set_content) = create_signal(String::new());
    let (result, set_result) = create_signal::<Option<String>>(None);

    let submit = create_action(move |_: &()| {
        let y = yaml.get();
        let c = content.get();
        async move {
            let body = json!({ "yaml": y, "trigger": "prompt_ingress", "content": c });
            match api::post_json::<serde_json::Value>("/admin/rules/dry-run", &body).await {
                Ok(v) => set_result.set(Some(serde_json::to_string_pretty(&v).unwrap_or_default())),
                Err(e) => set_result.set(Some(format!("error: {e}"))),
            }
        }
    });

    view! {
        <h2 class="text-2xl font-semibold mb-4">"Rules Dry-run"</h2>
        <label class="block text-sm text-slate-400 mb-1">"YAML"</label>
        <textarea class="w-full h-40 rounded bg-slate-900 border border-slate-800 p-3 font-mono text-sm mb-3"
            prop:value=move || yaml.get()
            on:input=move |ev| set_yaml.set(event_target_value(&ev))
        />
        <label class="block text-sm text-slate-400 mb-1">"Sample prompt content"</label>
        <input class="w-full rounded bg-slate-900 border border-slate-800 p-3 mb-4"
            prop:value=move || content.get()
            on:input=move |ev| set_content.set(event_target_value(&ev))
        />
        <button class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500"
            on:click=move |_| submit.dispatch(())
        >"Dry-run"</button>

        {move || result.get().map(|s| view!{
            <pre class="mt-6 rounded bg-slate-900 border border-slate-800 p-4 overflow-x-auto text-sm">{s}</pre>
        })}
    }
}
