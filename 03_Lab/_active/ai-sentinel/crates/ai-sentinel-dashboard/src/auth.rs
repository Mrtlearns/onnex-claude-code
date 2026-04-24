use gloo_storage::{SessionStorage, Storage};

const KEY: &str = "ai_sentinel_admin_token";

pub fn get_token() -> Option<String> {
    SessionStorage::get::<String>(KEY).ok()
}

pub fn set_token(t: &str) {
    let _ = SessionStorage::set(KEY, t);
}

pub fn clear_token() {
    SessionStorage::delete(KEY);
}
