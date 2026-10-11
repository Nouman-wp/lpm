import SwiftUI
import UIKit

@main
struct LpmMobileApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()
    @AppStorage(AppearanceMode.storageKey) private var appearanceRaw = AppearanceMode.system.rawValue

    init() {
        // Pin every nav-bar state (standard/compact/scrollEdge) to the same
        // compact, adaptive appearance and turn off large titles. This is what
        // fixes the push glitch where the bar briefly rendered its tall large-title
        // variant before settling — height is now stable from the first frame.
        // The terminal screen layers its own translucent background over this; all
        // other screens (Project detail, etc.) get this clean adaptive bar.
        let bar = UINavigationBar.appearance()
        let appearance = UINavigationBarAppearance()
        appearance.configureWithDefaultBackground()
        bar.standardAppearance = appearance
        bar.compactAppearance = appearance
        bar.scrollEdgeAppearance = appearance
        bar.prefersLargeTitles = false
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(model)
                .onAppear { appDelegate.attach(model) }
                .task {
                    // TEMP e2e hook — reverted after the run.
                    let env = ProcessInfo.processInfo.environment
                    if let spec = env["LPM_E2E_PAIR"] {
                        let p = spec.split(separator: ":").map(String.init)
                        try? await Task.sleep(nanoseconds: 1_500_000_000)
                        model.pair(hosts: [p[0]], port: Int(p[1])!, code: p[2])
                    }
                    if env["LPM_E2E_SHEET"] != nil {
                        try? await Task.sleep(nanoseconds: 4_000_000_000)
                        model.link.sheetOpen = true
                    }
                    if let after = env["LPM_E2E_INSTALL_AFTER"].flatMap(Double.init) {
                        try? await Task.sleep(nanoseconds: UInt64(after * 1e9))
                        if model.activeRecord?.port == 18767 { model.macUpdate.install() }
                    }
                }
                .preferredColorScheme((AppearanceMode(rawValue: appearanceRaw) ?? .system).colorScheme)
        }
    }
}
