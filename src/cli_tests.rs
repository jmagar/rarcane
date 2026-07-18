use serde_json::json;

use super::{parse_args_from, run, usage, Command, SetupCommand};
use crate::config::ArcaneConfig;

#[test]
fn empty_args_returns_none() {
    let result = parse_args_from::<_, String>([]).unwrap();
    assert!(result.is_none());
}

#[test]
fn call_parses_arcane_request() {
    let cmd = parse_args_from([
        "call",
        "--action",
        "container",
        "--subaction",
        "list",
        "--env-id",
        "env-1",
        "--params-json",
        r#"{"limit":10}"#,
    ])
    .unwrap()
    .unwrap();
    assert_eq!(
        cmd,
        Command::Call {
            action: "container".into(),
            subaction: Some("list".into()),
            env_id: Some("env-1".into()),
            id: None,
            params: json!({"limit": 10}),
        }
    );
}

#[test]
fn confirm_sets_boolean_param() {
    let cmd = parse_args_from([
        "call",
        "--action",
        "project",
        "--subaction",
        "down",
        "--env-id",
        "env-1",
        "--id",
        "stack",
        "--confirm",
    ])
    .unwrap()
    .unwrap();
    match cmd {
        Command::Call { params, .. } => assert_eq!(params["confirm"], true),
        other => panic!("unexpected command: {other:?}"),
    }
}

#[test]
fn call_requires_action() {
    let err = parse_args_from(["call", "--subaction", "list"]).unwrap_err();
    assert!(err.to_string().contains("--action"));
}

#[test]
fn help_accepts_domain() {
    let cmd = parse_args_from(["help", "--domain", "container"])
        .unwrap()
        .unwrap();
    assert_eq!(
        cmd,
        Command::Help {
            domain: Some("container".into())
        }
    );
}

#[test]
fn status_subcommand() {
    let cmd = parse_args_from(["status"]).unwrap().unwrap();
    assert_eq!(cmd, Command::Status);
}

#[tokio::test]
async fn local_status_and_help_do_not_require_upstream_credentials() {
    let config = ArcaneConfig::default();
    run(Command::Status, &config)
        .await
        .expect("local status should not construct a client");
    run(Command::Help { domain: None }, &config)
        .await
        .expect("local help should not construct a client");
}

#[test]
fn doctor_and_setup_still_parse() {
    assert_eq!(
        parse_args_from(["doctor", "--json"]).unwrap(),
        Some(Command::Doctor { json: true })
    );
    assert_eq!(
        parse_args_from(["setup", "check"]).unwrap(),
        Some(Command::Setup(SetupCommand::Check))
    );
}

#[test]
fn usage_mentions_call() {
    assert!(usage().contains("rarcane call --action"));
}
