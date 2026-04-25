//! First-boot preseed + policy engine hot-load helpers.

use ai_sentinel_modules::{LicenseTier, ModuleKind, ModuleStore, NewModule, PostgresModuleStore};
use ai_sentinel_rules::PolicyEngine;
use tracing::{info, warn};

/// Seven seed rule sets shipped with the binary.
///
/// Each entry is (filename basename, description, tier). YAML lives in `config/modules/`.
const PRESEED: &[(&str, &str, LicenseTier)] = &[
    ("education-k12", "K-12 school rule set with homework + PII guards", LicenseTier::Pro),
    ("education-higher-ed", "Higher-education research permissive set", LicenseTier::Pro),
    ("corporate-default", "Baseline enterprise guardrails", LicenseTier::Basic),
    ("healthcare-hipaa", "HIPAA-aware PHI + BAA-only providers", LicenseTier::Enterprise),
    ("legal-pi", "Plaintiff personal-injury law protections", LicenseTier::Pro),
    ("financial-pci-dss", "PCI-DSS cardholder-data guardrails", LicenseTier::Enterprise),
    ("dev-agent-lab", "Permissive observability-only lab set", LicenseTier::Basic),
];

/// Insert preseed modules only if the `modules` table is empty.
pub async fn preseed_if_empty(store: &PostgresModuleStore) -> anyhow::Result<()> {
    let existing = store.list(None).await?;
    if !existing.is_empty() {
        info!(count = existing.len(), "bootstrap: modules already present, skipping preseed");
        return Ok(());
    }

    for (name, desc, tier) in PRESEED {
        let path = format!("config/modules/{name}.yaml");
        let yaml = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                warn!(path, error = %e, "bootstrap: preseed file missing, skipping");
                continue;
            }
        };
        let nm = NewModule {
            kind: ModuleKind::Rules,
            name: (*name).to_string(),
            description: (*desc).to_string(),
            license_tier: *tier,
            initial_config_yaml: yaml,
        };
        match store.create("system-preseed", nm).await {
            Ok(m) => info!(id = m.id, name = %m.name, "bootstrap: preseeded module"),
            Err(e) => warn!(name, error = %e, "bootstrap: preseed create failed"),
        }
    }
    Ok(())
}

/// Force-update every preseed module in the database with the YAML on disk. Triggered
/// from `POST /admin/preseed/refresh`. For each preseed:
///   - if the module exists, call update_config (creates a new version)
///   - if it doesn't, create it
/// Returns (updated_count, created_count).
pub async fn resync_preseeds(
    store: &PostgresModuleStore,
    actor: &str,
) -> anyhow::Result<(usize, usize)> {
    let mut updated = 0usize;
    let mut created = 0usize;
    for (name, desc, tier) in PRESEED {
        let path = format!("config/modules/{name}.yaml");
        let yaml = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                warn!(path, error = %e, "preseed-refresh: file missing, skipping");
                continue;
            }
        };
        let existing = store.get_by_name(ai_sentinel_modules::ModuleKind::Rules, name).await?;
        match existing {
            Some(m) => {
                let update = ai_sentinel_modules::ModuleUpdate {
                    config_yaml: yaml,
                    description: Some((*desc).to_string()),
                    expected_version: m.current_version,
                };
                match store.update_config(actor, m.id, update).await {
                    Ok(updated_m) => {
                        info!(id = m.id, name, new_version = updated_m.current_version, "preseed-refresh: updated");
                        updated += 1;
                    }
                    Err(e) => warn!(name, error = %e, "preseed-refresh: update failed"),
                }
            }
            None => {
                let nm = ai_sentinel_modules::NewModule {
                    kind: ai_sentinel_modules::ModuleKind::Rules,
                    name: (*name).to_string(),
                    description: (*desc).to_string(),
                    license_tier: *tier,
                    initial_config_yaml: yaml,
                };
                match store.create(actor, nm).await {
                    Ok(m) => {
                        info!(id = m.id, name, "preseed-refresh: created");
                        created += 1;
                    }
                    Err(e) => warn!(name, error = %e, "preseed-refresh: create failed"),
                }
            }
        }
    }
    Ok((updated, created))
}

/// Load every enabled `rules`-kind module into the `PolicyEngine`.
pub async fn load_active_into_engine(
    store: &PostgresModuleStore,
    engine: &PolicyEngine,
) -> anyhow::Result<()> {
    let modules = store.list(Some(ModuleKind::Rules)).await?;
    let mut loaded = 0usize;
    for m in modules {
        let yaml = match store.current_config_yaml(m.id).await {
            Ok(y) => y,
            Err(e) => {
                warn!(id = m.id, error = %e, "bootstrap: fetch yaml failed");
                continue;
            }
        };
        match engine.load_or_replace(m.id, m.name.clone(), m.enabled, &yaml) {
            Ok(_) => loaded += 1,
            Err(e) => warn!(id = m.id, name = %m.name, error = %e, "bootstrap: compile failed"),
        }
    }
    engine.warn_on_compile_errors();
    info!(loaded, "bootstrap: policy engine loaded active rule sets");
    Ok(())
}
