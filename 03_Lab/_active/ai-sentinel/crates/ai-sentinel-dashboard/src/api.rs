//! Thin fetch wrappers around `/admin/*` and `/sentinel/*`.
//!
//! Auth model: the dashboard sits behind Traefik HTTP basic auth, so the browser
//! automatically attaches `Authorization: Basic …` to every same-origin request.
//! The dashboard does NOT manage tokens — no Bearer header is set client-side.

use gloo_net::http::RequestBuilder;
use serde::de::DeserializeOwned;
use serde::Serialize;

fn base() -> String {
    String::new()
}

fn with_extra_headers(mut req: RequestBuilder, extras: &[(&str, &str)]) -> RequestBuilder {
    for (k, v) in extras {
        req = req.header(k, v);
    }
    req
}

pub async fn get<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    let url = format!("{}{path}", base());
    let req = gloo_net::http::Request::get(&url)
        .build()
        .map_err(|e| e.to_string())?;
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
    post_json_with_headers(path, body, &[]).await
}

pub async fn post_json_with_headers<T, B>(
    path: &str,
    body: &B,
    extra_headers: &[(&str, &str)],
) -> Result<T, String>
where
    T: DeserializeOwned,
    B: Serialize + ?Sized,
{
    let url = format!("{}{path}", base());
    let builder = gloo_net::http::Request::post(&url).header("Content-Type", "application/json");
    let builder = with_extra_headers(builder, extra_headers);
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
    let req = gloo_net::http::Request::post(&url)
        .build()
        .map_err(|e| e.to_string())?;
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let parsed: T = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parsed)
}
