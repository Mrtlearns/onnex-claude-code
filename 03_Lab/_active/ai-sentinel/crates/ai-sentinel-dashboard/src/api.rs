//! Thin fetch wrappers around the `/admin/*` API. Bearer token comes from sessionStorage.

use crate::auth;
use gloo_net::http::Request;
use serde::de::DeserializeOwned;
use serde_json::Value;

fn base() -> String {
    // Dashboard is served from the same origin as the API in production.
    // In dev (trunk serve) we rely on CORS passthrough or a dev proxy.
    String::new()
}

fn attach_auth(req: Request) -> Request {
    if let Some(t) = auth::get_token() {
        req.headers().set("Authorization", &format!("Bearer {t}"));
    }
    req
}

pub async fn get<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    let url = format!("{}{path}", base());
    let req = attach_auth(Request::get(&url));
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<T>().await.map_err(|e| e.to_string())
}

pub async fn post_json<T: DeserializeOwned>(path: &str, body: &Value) -> Result<T, String> {
    let url = format!("{}{path}", base());
    let req = attach_auth(Request::post(&url));
    req.headers().set("Content-Type", "application/json");
    let req = req.json(body).map_err(|e| e.to_string())?;
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<T>().await.map_err(|e| e.to_string())
}

pub async fn post_empty<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    let url = format!("{}{path}", base());
    let req = attach_auth(Request::post(&url));
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<T>().await.map_err(|e| e.to_string())
}
