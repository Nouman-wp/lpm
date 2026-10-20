// Who the listener is up for. "Allow control" opens it to paired machines; a
// shared tab opens it to that tab's guests alone, only while the tab is shared,
// and never by changing the saved setting.
use super::*;

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Listen {
    pub bind: String,
    pub paired: bool,
}

pub(crate) fn plan(cfg: &HostConfig, sharing: bool) -> Option<Listen> {
    if cfg.enabled {
        return Some(Listen {
            bind: bind_address(cfg),
            paired: true,
        });
    }
    sharing.then(|| Listen {
        bind: share_bind(cfg),
        paired: false,
    })
}

/// Where a shared tab's guests reach this machine: the address the user chose,
/// or every interface when they never chose one.
pub(crate) fn share_bind(cfg: &HostConfig) -> String {
    if cfg.enabled || !cfg.bind_address.trim().is_empty() {
        bind_address(cfg)
    } else {
        ALL_INTERFACES.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn control_off() -> HostConfig {
        HostConfig::default()
    }

    #[test]
    fn nothing_listens_with_control_off_and_nothing_shared() {
        assert_eq!(plan(&control_off(), false), None);
    }

    #[test]
    fn a_share_opens_the_listener_to_guests_only() {
        let cfg = control_off();
        assert_eq!(
            plan(&cfg, true),
            Some(Listen {
                bind: ALL_INTERFACES.to_string(),
                paired: false,
            })
        );
        assert!(!cfg.enabled && !cfg.lan, "the saved setting is untouched");
    }

    // Someone who bound the listener to loopback, or to their tailnet address,
    // kept it off the other interfaces on purpose.
    #[test]
    fn a_share_never_widens_an_address_the_user_chose() {
        for chosen in [LOOPBACK, "100.64.0.5"] {
            let cfg = HostConfig {
                bind_address: chosen.into(),
                ..control_off()
            };
            assert_eq!(plan(&cfg, true).unwrap().bind, chosen);
        }
    }

    #[test]
    fn the_last_share_ending_closes_a_guests_only_listener() {
        let cfg = control_off();
        assert!(plan(&cfg, true).is_some());
        assert_eq!(plan(&cfg, false), None);
    }

    // With control on, sharing changes nothing: paired machines would otherwise
    // be dropped every time a tab is shared or stops being shared.
    #[test]
    fn sharing_leaves_control_on_as_it_is() {
        let cfg = HostConfig {
            enabled: true,
            lan: true,
            ..control_off()
        };
        assert_eq!(plan(&cfg, true), plan(&cfg, false));
        assert!(plan(&cfg, false).unwrap().paired);
    }
}
