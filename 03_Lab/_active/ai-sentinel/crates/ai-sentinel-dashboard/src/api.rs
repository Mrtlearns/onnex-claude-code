//! Thin fetch wrappers around the `/admin/*` API. Bearer token comes from sessionStorage.
//!
//! gloo-net 0.5 split the types: `Request::get(url)` / `::post(url)` return a
//! `RequestBuilder`; `.build()` or `.send()` on the builder gives a `Request` / future.
//! Headers are added on the builder via `.header(k, v)`.

use crate::auth;
use gloo_net::http::RequestBuilder;
use serde::de::DeserializeOwned;
use serde::Serialize;

fn base() -> String {
    // Dashboard is served from the same origin as the API in production.
    String::new()
}

fn with_auth(req: RequestBuilder) -> RequestBuilder {
    match auth::get_token() {
        Some(t) => req.header("Authorization", &format!("Bearer {t}")),
        None => req,
    }
}

pub async fn get<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    let url = format!("{}{path}", base());
    let builder = with_auth(gloo_net::http::Request::get(&url));
    let req = builder.build().map_err(|e| e.to_string())?;
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let parsed: T = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parsed)
}

pub async fn post_json<T, B>(path: &str, body: &B) -> Result<T, String>
where
    T: DeserializeOwned,
    B: Serialize + ?Sized,
{
    let url = format!("{}{path}", base());
    let builder = with_auth(gloo_net::http::Request::post(&url))
        .header("Content-Type", "application/json");
    let req = builder.json(body).map_err(|e| e.to_string())?;
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let parsed: T = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parsed)
}

pub async fn post_empty<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    let url = format!("{}{path}", base());
    let builder = with_auth(gloo_net::http::Request::post(&url));
    let req = builder.build().map_err(|e| e.to_string())?;
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let parsed: T = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parsed)
}
