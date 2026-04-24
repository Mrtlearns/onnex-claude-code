use crate::audit::ModuleAuditChain;
use crate::types::{
    LicenseTier, Module, ModuleAction, ModuleKind, ModuleUpdate, ModuleVersion, NewModule,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ModuleStoreError {
    #[error("module not found: {0}")]
    NotFound(i64),
    #[error("version conflict: expected {expected}, found {found}")]
    VersionConflict { expected: i32, found: i32 },
    #[error("invalid kind: {0}")]
    InvalidKind(String),
    #[error(transparent)]
    Sql(#[from] sqlx::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

#[async_trait]
pub trait ModuleStore: Send + Sync {
    async fn list(&self, filter_kind: Option<ModuleKind>) -> Result<Vec<Module>, ModuleStoreError>;
    async fn get(&self, id: i64) -> Result<Module, ModuleStoreError>;
    async fn get_by_name(
        &self,
        kind: ModuleKind,
        name: &str,
    ) -> Result<Option<Module>, ModuleStoreError>;
    async fn create(&self, actor: &str, nm: NewModule) -> Result<Module, ModuleStoreError>;
    async fn update_config(
        &self,
        actor: &str,
        id: i64,
        u: ModuleUpdate,
    ) -> Result<Module, ModuleStoreError>;
    async fn set_enabled(
        &self,
        actor: &str,
        id: i64,
        enabled: bool,
    ) -> Result<Module, ModuleStoreError>;
    async fn revert(&self, actor: &str, id: i64, target_version: i32) -> Result<Module, ModuleStoreError>;
    async fn delete(&self, actor: &str, id: i64) -> Result<(), ModuleStoreError>;
    async fn versions(&self, id: i64) -> Result<Vec<ModuleVersion>, ModuleStoreError>;
    async fn version(&self, id: i64, version: i32) -> Result<ModuleVersion, ModuleStoreError>;
    async fn current_config_yaml(&self, id: i64) -> Result<String, ModuleStoreError>;
}

pub struct PostgresModuleStore {
    pool: PgPool,
    audit: ModuleAuditChain,
}

impl PostgresModuleStore {
    pub async fn new(pool: PgPool) -> anyhow::Result<Self> {
        let audit = ModuleAuditChain::new(pool.clone()).await?;
        Ok(Self { pool, audit })
    }

    pub fn audit(&self) -> &ModuleAuditChain {
        &self.audit
    }

    fn hash_config(yaml: &str) -> String {
        let mut h = Sha256::new();
        h.update(yaml.as_bytes());
        hex::encode(h.finalize())
    }

    fn row_to_module(row: &sqlx::postgres::PgRow) -> Result<Module, ModuleStoreError> {
        let kind_str: String = row.try_get("kind")?;
        let kind = ModuleKind::parse(&kind_str)
            .ok_or_else(|| ModuleStoreError::InvalidKind(kind_str.clone()))?;
        let tier_str: String = row.try_get("license_tier")?;
        Ok(Module {
            id: row.try_get("id")?,
            kind,
            name: row.try_get("name")?,
            description: row.try_get("description")?,
            enabled: row.try_get("enabled")?,
            current_version: row.try_get("current_version")?,
            license_tier: LicenseTier::parse(&tier_str),
            created_at: row.try_get::<DateTime<Utc>, _>("created_at")?,
            updated_at: row.try_get::<DateTime<Utc>, _>("updated_at")?,
        })
    }
}

#[async_trait]
impl ModuleStore for PostgresModuleStore {
    async fn list(&self, filter_kind: Option<ModuleKind>) -> Result<Vec<Module>, ModuleStoreError> {
        let rows = if let Some(k) = filter_kind {
            sqlx::query(
                "SELECT id, kind, name, description, enabled, current_version, license_tier, \
                        created_at, updated_at FROM modules WHERE kind = $1 ORDER BY kind, name",
            )
            .bind(k.as_str())
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query(
                "SELECT id, kind, name, description, enabled, current_version, license_tier, \
                        created_at, updated_at FROM modules ORDER BY kind, name",
            )
            .fetch_all(&self.pool)
            .await?
        };
        rows.iter().map(Self::row_to_module).collect()
    }

    async fn get(&self, id: i64) -> Result<Module, ModuleStoreError> {
        let row = sqlx::query(
            "SELECT id, kind, name, description, enabled, current_version, license_tier, \
                    created_at, updated_at FROM modules WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ModuleStoreError::NotFound(id))?;
        Self::row_to_module(&row)
    }

    async fn get_by_name(
        &self,
        kind: ModuleKind,
        name: &str,
    ) -> Result<Option<Module>, ModuleStoreError> {
        let row = sqlx::query(
            "SELECT id, kind, name, description, enabled, current_version, license_tier, \
                    created_at, updated_at FROM modules WHERE kind = $1 AND name = $2",
        )
        .bind(kind.as_str())
        .bind(name)
        .fetch_optional(&self.pool)
        .await?;
        row.as_ref().map(Self::row_to_module).transpose()
    }

    async fn create(&self, actor: &str, nm: NewModule) -> Result<Module, ModuleStoreError> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query(
            "INSERT INTO modules (kind, name, description, enabled, current_version, license_tier) \
             VALUES ($1, $2, $3, FALSE, 1, $4) \
             RETURNING id, kind, name, description, enabled, current_version, license_tier, \
                       created_at, updated_at",
        )
        .bind(nm.kind.as_str())
        .bind(&nm.name)
        .bind(&nm.description)
        .bind(nm.license_tier.as_str())
        .fetch_one(&mut *tx)
        .await?;
        let module = Self::row_to_module(&row)?;

        let config_hash = Self::hash_config(&nm.initial_config_yaml);
        sqlx::query(
            "INSERT INTO module_versions (module_id, version, config_yaml, config_hash, created_by) \
             VALUES ($1, 1, $2, $3, $4)",
        )
        .bind(module.id)
        .bind(&nm.initial_config_yaml)
        .bind(&config_hash)
        .bind(actor)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.audit
            .write(
                ModuleAction::Create,
                actor,
                Some(module.id),
                None,
                Some(1),
                Some(json!({ "kind": nm.kind.as_str(), "name": nm.name, "license_tier": nm.license_tier.as_str() })),
            )
            .await?;

        Ok(module)
    }

    async fn update_config(
        &self,
        actor: &str,
        id: i64,
        u: ModuleUpdate,
    ) -> Result<Module, ModuleStoreError> {
        let current = self.get(id).await?;
        if current.current_version != u.expected_version {
            return Err(ModuleStoreError::VersionConflict {
                expected: u.expected_version,
                found: current.current_version,
            });
        }
        let new_version = current.current_version + 1;
        let config_hash = Self::hash_config(&u.config_yaml);

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO module_versions (module_id, version, config_yaml, config_hash, created_by) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(id)
        .bind(new_version)
        .bind(&u.config_yaml)
        .bind(&config_hash)
        .bind(actor)
        .execute(&mut *tx)
        .await?;

        let row = sqlx::query(
            "UPDATE modules SET current_version = $1, \
                                description = COALESCE($2, description), \
                                updated_at = NOW() \
             WHERE id = $3 \
             RETURNING id, kind, name, description, enabled, current_version, license_tier, \
                       created_at, updated_at",
        )
        .bind(new_version)
        .bind(&u.description)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;

        let updated = Self::row_to_module(&row)?;

        self.audit
            .write(
                ModuleAction::Update,
                actor,
                Some(id),
                Some(current.current_version),
                Some(new_version),
                Some(json!({ "config_hash": config_hash })),
            )
            .await?;

        Ok(updated)
    }

    async fn set_enabled(
        &self,
        actor: &str,
        id: i64,
        enabled: bool,
    ) -> Result<Module, ModuleStoreError> {
        let before = self.get(id).await?;
        if before.enabled == enabled {
            return Ok(before);
        }
        let row = sqlx::query(
            "UPDATE modules SET enabled = $1, updated_at = NOW() WHERE id = $2 \
             RETURNING id, kind, name, description, enabled, current_version, license_tier, \
                       created_at, updated_at",
        )
        .bind(enabled)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        let updated = Self::row_to_module(&row)?;
        self.audit
            .write(
                if enabled { ModuleAction::Enable } else { ModuleAction::Disable },
                actor,
                Some(id),
                Some(before.current_version),
                Some(before.current_version),
                None,
            )
            .await?;
        Ok(updated)
    }

    async fn revert(
        &self,
        actor: &str,
        id: i64,
        target_version: i32,
    ) -> Result<Module, ModuleStoreError> {
        let before = self.get(id).await?;
        let target = self.version(id, target_version).await?;
        let new_version = before.current_version + 1;
        let config_hash = Self::hash_config(&target.config_yaml);

        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO module_versions (module_id, version, config_yaml, config_hash, created_by) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(id)
        .bind(new_version)
        .bind(&target.config_yaml)
        .bind(&config_hash)
        .bind(actor)
        .execute(&mut *tx)
        .await?;
        let row = sqlx::query(
            "UPDATE modules SET current_version = $1, updated_at = NOW() WHERE id = $2 \
             RETURNING id, kind, name, description, enabled, current_version, license_tier, \
                       created_at, updated_at",
        )
        .bind(new_version)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;

        let updated = Self::row_to_module(&row)?;
        self.audit
            .write(
                ModuleAction::Revert,
                actor,
                Some(id),
                Some(before.current_version),
                Some(new_version),
                Some(json!({ "reverted_to_version": target_version })),
            )
            .await?;
        Ok(updated)
    }

    async fn delete(&self, actor: &str, id: i64) -> Result<(), ModuleStoreError> {
        let before = self.get(id).await?;
        sqlx::query("DELETE FROM modules WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        self.audit
            .write(
                ModuleAction::Delete,
                actor,
                Some(id),
                Some(before.current_version),
                None,
                Some(json!({ "name": before.name, "kind": before.kind.as_str() })),
            )
            .await?;
        Ok(())
    }

    async fn versions(&self, id: i64) -> Result<Vec<ModuleVersion>, ModuleStoreError> {
        let rows = sqlx::query(
            "SELECT id, module_id, version, config_yaml, config_hash, created_by, created_at \
             FROM module_versions WHERE module_id = $1 ORDER BY version DESC",
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter()
            .map(|r| {
                Ok(ModuleVersion {
                    id: r.try_get("id")?,
                    module_id: r.try_get("module_id")?,
                    version: r.try_get("version")?,
                    config_yaml: r.try_get("config_yaml")?,
                    config_hash: r.try_get("config_hash")?,
                    created_by: r.try_get("created_by")?,
                    created_at: r.try_get::<DateTime<Utc>, _>("created_at")?,
                })
            })
            .collect()
    }

    async fn version(&self, id: i64, version: i32) -> Result<ModuleVersion, ModuleStoreError> {
        let row = sqlx::query(
            "SELECT id, module_id, version, config_yaml, config_hash, created_by, created_at \
             FROM module_versions WHERE module_id = $1 AND version = $2",
        )
        .bind(id)
        .bind(version)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ModuleStoreError::NotFound(id))?;
        Ok(ModuleVersion {
            id: row.try_get("id")?,
            module_id: row.try_get("module_id")?,
            version: row.try_get("version")?,
            config_yaml: row.try_get("config_yaml")?,
            config_hash: row.try_get("config_hash")?,
            created_by: row.try_get("created_by")?,
            created_at: row.try_get::<DateTime<Utc>, _>("created_at")?,
        })
    }

    async fn current_config_yaml(&self, id: i64) -> Result<String, ModuleStoreError> {
        let m = self.get(id).await?;
        let v = self.version(id, m.current_version).await?;
        Ok(v.config_yaml)
    }
}
