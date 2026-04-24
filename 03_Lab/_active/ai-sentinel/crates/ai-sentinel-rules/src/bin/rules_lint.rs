//! `rules-lint` — offline linter for YAML rule sets.
//!
//! Usage:  `cargo run --bin rules-lint -- config/modules/*.yaml`
//!
//! Exit code 0 = all files compiled; non-zero otherwise. Intended for CI.

use ai_sentinel_rules::compile_yaml;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("usage: rules-lint <file.yaml> [<file.yaml> ...]");
        return ExitCode::from(2);
    }

    let mut fail = 0;
    for path in &args {
        let content = match std::fs::read_to_string(path) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("{path}: read error: {e}");
                fail += 1;
                continue;
            }
        };
        match compile_yaml(&content) {
            Ok(set) => {
                if !set.errors.is_empty() {
                    eprintln!("{path}: {} rule error(s):", set.errors.len());
                    for e in &set.errors {
                        eprintln!("  {e}");
                    }
                    fail += 1;
                } else {
                    println!(
                        "OK  {path}  — module={} version={} tier={} rules={}",
                        set.module,
                        set.version,
                        set.license_tier,
                        set.rules.len()
                    );
                }
            }
            Err(e) => {
                eprintln!("{path}: compile error: {e}");
                fail += 1;
            }
        }
    }

    if fail == 0 {
        ExitCode::SUCCESS
    } else {
        eprintln!("\n{fail} file(s) failed lint");
        ExitCode::from(1)
    }
}
