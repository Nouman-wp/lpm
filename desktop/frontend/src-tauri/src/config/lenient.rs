//! Action sections read entry by entry, so one malformed action drops only
//! itself instead of every action in the file (and its `extends` templates).
//! `check` reports what was dropped.
use super::{ActionDef, ActionInputDef};
use serde::{Deserialize, Deserializer};
use serde_norway::Value;
use std::collections::BTreeMap;

pub(super) fn key_text(key: &Value) -> Option<String> {
    match key {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

pub(super) fn actions<'de, D: Deserializer<'de>>(
    d: D,
) -> Result<BTreeMap<String, ActionDef>, D::Error> {
    let Value::Mapping(map) = Value::deserialize(d)? else {
        return Ok(BTreeMap::new());
    };
    Ok(map
        .into_iter()
        .filter_map(|(k, v)| Some((key_text(&k)?, serde_norway::from_value(v).ok()?)))
        .collect())
}

pub(super) fn strings<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<String>, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::String(s) => vec![s],
        Value::Sequence(items) => items
            .into_iter()
            .filter_map(|v| match v {
                Value::String(s) => Some(s),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    })
}

/// `inputs` keyed by name, or a list whose entries name themselves with `key`
/// (the shape lpm Link wrote). A malformed input fails its action: running it
/// without one of its values would be worse than not offering it.
pub(super) fn inputs<'de, D: Deserializer<'de>>(
    d: D,
) -> Result<BTreeMap<String, ActionInputDef>, D::Error> {
    use serde::de::Error;
    match Value::deserialize(d)? {
        Value::Null => Ok(BTreeMap::new()),
        Value::Sequence(items) => items
            .into_iter()
            .map(|item| {
                let (key, rest) = split_keyed(item).ok_or_else(|| {
                    D::Error::custom("each input in a list needs a `key`")
                })?;
                let def = serde_norway::from_value(rest).map_err(D::Error::custom)?;
                Ok((key, def))
            })
            .collect(),
        other => serde_norway::from_value(other).map_err(D::Error::custom),
    }
}

/// A list-form input split into its `key` and the rest of its fields.
pub(super) fn split_keyed(item: Value) -> Option<(String, Value)> {
    let Value::Mapping(mut map) = item else {
        return None;
    };
    let key = map.remove("key").as_ref().and_then(key_text)?;
    Some((key, Value::Mapping(map)))
}

#[cfg(test)]
mod tests {
    use super::super::{build_base_layer, build_input_infos, ActionsYaml};

    fn layer(yml: &str) -> std::collections::BTreeMap<String, super::super::ActionFull> {
        build_base_layer(&serde_norway::from_str::<ActionsYaml>(yml).unwrap())
    }

    #[test]
    fn list_inputs_read_like_the_map_form() {
        let actions = layer(
            "actions:\n  greet:\n    cmd: echo {{who}}\n    inputs:\n      - key: who\n        label: Who\n        default: World\n",
        );
        let infos = build_input_infos(&actions["greet"].inputs);
        assert_eq!(infos.len(), 1);
        assert_eq!(infos[0].key, "who");
        assert_eq!(infos[0].label, "Who");
        assert_eq!(infos[0].default, "World");
    }

    #[test]
    fn one_malformed_action_drops_only_itself() {
        let yml = "extends: [web-tools]\nactions:\n  echo: echo hi\n  pick:\n    cmd: x\n    inputs:\n      c:\n        type: radio\n        options:\n          - label: Only label\nterminals:\n  shell: zsh\n";
        let y: ActionsYaml = serde_norway::from_str(yml).unwrap();
        assert_eq!(y.extends, vec!["web-tools"]);
        let actions = build_base_layer(&y);
        assert!(actions.contains_key("echo"));
        assert!(actions.contains_key("shell"));
        assert!(!actions.contains_key("pick"));
    }

    #[test]
    fn a_malformed_child_drops_only_itself() {
        let actions = layer("actions:\n  deploy:\n    actions:\n      prod: ./deploy prod\n      bad:\n        cmd: [1]\n");
        let children: Vec<&String> = actions["deploy"].actions.keys().collect();
        assert_eq!(children, vec!["prod"]);
    }

    #[test]
    fn a_keyless_list_input_drops_its_action() {
        assert!(layer("actions:\n  greet:\n    cmd: x\n    inputs:\n      - label: Who\n").is_empty());
    }
}
