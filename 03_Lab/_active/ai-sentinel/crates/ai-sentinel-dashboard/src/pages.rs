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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: i64,
    pub action: String,
    pub actor: String,
    pub timestamp: Option<String>,
    pub before_version: Option<i32>,
    pub after_version: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
            match api::post_json::<serde_json::Value, serde_json::Value>("/admin/rules/dry-run", &body).await {
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

// ─── Testing page (Phase 6) ─────────────────────────────────────────────────
//
// Four panels: Prompt tester, Sentinel mode toggle, Recent traces, Before/After.
// All talk to the testmode routes (/chat, /sentinel/mode, /sentinel/traces).

#[derive(Clone, Serialize, Deserialize)]
pub struct ChatResponseEnvelope {
    pub sentinel: serde_json::Value,
    #[serde(default)]
    pub upstream: Option<serde_json::Value>,
}

#[component]
pub fn TestingPage() -> impl IntoView {
    view! {
        <div class="space-y-8">
            <h2 class="text-2xl font-semibold">"Testing"</h2>
            <p class="text-sm text-slate-400 -mt-6">
                "Developer tool. Exercises the Onnex Armory v1.0 HTTP contract end-to-end."
            </p>
            <SentinelModePanel/>
            <PromptTesterPanel/>
            <BeforeAfterPanel/>
            <RecentTracesPanel/>
        </div>
    }
}

#[component]
fn SentinelModePanel() -> impl IntoView {
    let (current, set_current) = create_signal(String::from("full"));
    let (since, set_since) = create_signal(String::new());

    let refresh = create_action(move |_: &()| async move {
        if let Ok(v) = api::get::<serde_json::Value>("/sentinel/mode").await {
            if let Some(m) = v.get("mode").and_then(|x| x.as_str()) {
                set_current.set(m.to_string());
            }
            if let Some(s) = v.get("since").and_then(|x| x.as_str()) {
                set_since.set(s.to_string());
            }
        }
    });
    refresh.dispatch(());

    let set_mode = create_action(move |mode: &String| {
        let mode = mode.clone();
        async move {
            let body = json!({ "mode": mode });
            let _ = api::post_json::<serde_json::Value, serde_json::Value>("/sentinel/mode", &body).await;
        }
    });

    let on_click = move |mode_name: &'static str| {
        move |_| {
            set_mode.dispatch(mode_name.to_string());
            set_current.set(mode_name.to_string());
            refresh.dispatch(());
        }
    };

    view! {
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h3 class="font-semibold mb-2">"Sentinel Mode"</h3>
            <p class="text-sm text-slate-400 mb-4">
                "Full = normal enforcement. Observe = rules evaluated, nothing blocked. Bypass = inspection skipped."
            </p>
            <div class="flex gap-2">
                {["full", "observe", "bypass"].into_iter().map(|m| {
                    let label = m.to_string();
                    let active = move || current.get() == m;
                    view!{
                        <button
                            class=move || if active() {
                                "px-4 py-2 rounded bg-indigo-600 text-white font-semibold"
                            } else {
                                "px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            }
                            on:click=on_click(m)
                        >{label}</button>
                    }
                }).collect_view()}
            </div>
            <div class="mt-3 text-xs text-slate-500">
                "Current: " <span class="text-slate-300">{move || current.get()}</span>
                " · since " <span class="text-slate-400">{move || since.get()}</span>
            </div>
        </section>
    }
}

#[component]
fn PromptTesterPanel() -> impl IntoView {
    let (prompt, set_prompt) = create_signal(String::new());
    let (upstream_mode, set_upstream_mode) = create_signal(String::from("simulated"));
    let (model, set_model) = create_signal(String::new());
    let (result, set_result) = create_signal::<Option<String>>(None);

    let submit = create_action(move |_: &()| {
        let p = prompt.get();
        let um = upstream_mode.get();
        let m = model.get();
        async move {
            let mut body = json!({ "message": p, "upstream_mode": um });
            if !m.is_empty() {
                body["model"] = serde_json::Value::String(m);
            }
            match api::post_json::<serde_json::Value, serde_json::Value>("/chat", &body).await {
                Ok(v) => set_result.set(Some(serde_json::to_string_pretty(&v).unwrap_or_default())),
                Err(e) => set_result.set(Some(format!("error: {e}"))),
            }
        }
    });

    view! {
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h3 class="font-semibold mb-2">"Prompt Tester"</h3>
            <p class="text-sm text-slate-400 mb-3">
                "Send a prompt through the full pipeline. Simulated mode never calls an upstream LLM; live mode calls OpenRouter (cheap model)."
            </p>
            <textarea class="w-full h-28 rounded bg-slate-950 border border-slate-800 p-3 font-mono text-sm mb-3"
                prop:value=move || prompt.get()
                on:input=move |ev| set_prompt.set(event_target_value(&ev))
                placeholder="enter a prompt — try 'What is your return policy?' or 'Please solve my homework'"
            />
            <div class="flex gap-3 items-center mb-3">
                <label class="text-sm text-slate-400">"Upstream:"</label>
                <select class="rounded bg-slate-950 border border-slate-800 p-2 text-sm"
                    on:change=move |ev| set_upstream_mode.set(event_target_value(&ev))>
                    <option value="simulated" selected=true>"simulated"</option>
                    <option value="live">"live (OpenRouter)"</option>
                </select>
                <label class="text-sm text-slate-400 ml-2">"Model override:"</label>
                <input class="flex-1 rounded bg-slate-950 border border-slate-800 p-2 text-sm"
                    placeholder="google/gemini-flash-1.5-8b"
                    prop:value=move || model.get()
                    on:input=move |ev| set_model.set(event_target_value(&ev))/>
            </div>
            <button class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                on:click=move |_| submit.dispatch(())>
                "Submit"
            </button>
            {move || result.get().map(|s| view!{
                <pre class="mt-4 rounded bg-slate-950 border border-slate-800 p-4 overflow-x-auto text-xs">{s}</pre>
            })}
        </section>
    }
}

#[component]
fn BeforeAfterPanel() -> impl IntoView {
    let (prompt, set_prompt) = create_signal(String::new());
    let (before, set_before) = create_signal::<Option<String>>(None);
    let (after, set_after) = create_signal::<Option<String>>(None);

    let run = create_action(move |_: &()| {
        let p = prompt.get();
        async move {
            // "After" — enforcement ON
            let body = json!({ "message": &p, "upstream_mode": "live" });
            let after_fut = api::post_json::<serde_json::Value, serde_json::Value>("/chat", &body);

            // "Before" — bypass header (admin-authenticated) so nothing is inspected
            let body_b = json!({ "message": &p, "upstream_mode": "live" });
            let before_fut = api::post_json_with_headers::<serde_json::Value, serde_json::Value>(
                "/chat", &body_b,
                &[("X-Sentinel-Bypass", "true")],
            );

            // Sequential calls — two demo requests, fast enough without futures crate.
            let a = after_fut.await;
            let b = before_fut.await;
            set_after.set(Some(match a {
                Ok(v) => serde_json::to_string_pretty(&v).unwrap_or_default(),
                Err(e) => format!("error: {e}"),
            }));
            set_before.set(Some(match b {
                Ok(v) => serde_json::to_string_pretty(&v).unwrap_or_default(),
                Err(e) => format!("error: {e}"),
            }));
        }
    });

    view! {
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h3 class="font-semibold mb-2">"Before / After (WITHOUT vs WITH Sentinel)"</h3>
            <p class="text-sm text-slate-400 mb-3">
                "Sends the same prompt twice — once with X-Sentinel-Bypass (what the raw LLM would return) and once enforced. Both call the live upstream."
            </p>
            <input class="w-full rounded bg-slate-950 border border-slate-800 p-3 mb-3"
                placeholder="prompt to compare"
                prop:value=move || prompt.get()
                on:input=move |ev| set_prompt.set(event_target_value(&ev))/>
            <button class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                on:click=move |_| run.dispatch(())>"Compare"</button>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                    <div class="text-xs uppercase tracking-wide text-red-400 mb-1">"WITHOUT Sentinel"</div>
                    {move || before.get().map(|s| view!{
                        <pre class="rounded bg-slate-950 border border-red-900 p-3 overflow-x-auto text-xs">{s}</pre>
                    })}
                </div>
                <div>
                    <div class="text-xs uppercase tracking-wide text-emerald-400 mb-1">"WITH Sentinel"</div>
                    {move || after.get().map(|s| view!{
                        <pre class="rounded bg-slate-950 border border-emerald-900 p-3 overflow-x-auto text-xs">{s}</pre>
                    })}
                </div>
            </div>
        </section>
    }
}

#[component]
fn RecentTracesPanel() -> impl IntoView {
    let traces = create_resource(|| (), |_| async move {
        api::get::<serde_json::Value>("/sentinel/traces?limit=25").await
    });

    view! {
        <section class="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold">"Recent Traces"</h3>
                <button class="text-sm text-indigo-400 hover:text-indigo-300"
                    on:click=move |_| traces.refetch()>"Refresh"</button>
            </div>
            <Suspense fallback=move || view!{ <p class="text-slate-500 text-sm">"Loading…"</p> }>
                {move || match traces.get() {
                    Some(Ok(v)) => {
                        let list = v.get("traces").and_then(|a| a.as_array()).cloned().unwrap_or_default();
                        view! {
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-left text-xs uppercase text-slate-500 border-b border-slate-800">
                                        <th class="py-2">"Time"</th>
                                        <th class="py-2">"Verdict"</th>
                                        <th class="py-2">"Mode"</th>
                                        <th class="py-2">"Rule"</th>
                                        <th class="py-2">"Latency"</th>
                                        <th class="py-2">"Message"</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.into_iter().map(|t| {
                                        let verdict = t.get("verdict").and_then(|x| x.as_str()).unwrap_or("?").to_string();
                                        let mode = t.get("sentinel_mode").and_then(|x| x.as_str()).unwrap_or("").to_string();
                                        let rule = t.get("rule").and_then(|x| x.as_str()).unwrap_or("").to_string();
                                        let ms = t.get("latency_ms").and_then(|x| x.as_u64()).unwrap_or(0);
                                        let msg = t.get("request_message").and_then(|x| x.as_str()).unwrap_or("").to_string();
                                        let ts = t.get("timestamp").and_then(|x| x.as_str()).unwrap_or("").to_string();
                                        let msg_short: String = msg.chars().take(60).collect();
                                        let chip = match verdict.as_str() {
                                            "BLOCK" => "bg-red-900/50 text-red-300",
                                            "SANITIZE" => "bg-yellow-900/50 text-yellow-300",
                                            "ALLOW" => "bg-emerald-900/50 text-emerald-300",
                                            "BYPASS" => "bg-slate-700 text-slate-300",
                                            "ERROR" => "bg-orange-900/50 text-orange-300",
                                            _ => "bg-slate-800 text-slate-400",
                                        };
                                        view!{
                                            <tr class="border-b border-slate-800/50">
                                                <td class="py-2 text-xs text-slate-500">{ts.chars().take(19).collect::<String>()}</td>
                                                <td class="py-2">
                                                    <span class=format!("px-2 py-0.5 rounded text-xs {chip}")>{verdict}</span>
                                                </td>
                                                <td class="py-2 text-xs text-slate-400">{mode}</td>
                                                <td class="py-2 text-xs font-mono">{rule}</td>
                                                <td class="py-2 text-xs text-slate-500">{format!("{ms}ms")}</td>
                                                <td class="py-2 text-xs text-slate-300">{msg_short}</td>
                                            </tr>
                                        }
                                    }).collect_view()}
                                </tbody>
                            </table>
                        }.into_view()
                    }
                    Some(Err(e)) => view!{ <p class="text-red-400 text-sm">{format!("Error: {e}")}</p> }.into_view(),
                    None => ().into_view(),
                }}
            </Suspense>
        </section>
    }
}
