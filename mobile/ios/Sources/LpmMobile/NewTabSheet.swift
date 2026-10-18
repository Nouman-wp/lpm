import SwiftUI

/// What a new tab starts with: a plain shell or one of the agents the Mac can
/// start, with its model, effort and a first prompt, or a past conversation to
/// pick up again. The pick (not the prompt) is remembered for next time.
struct NewTabSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let project: Project
    let onOpen: (TerminalInfo) -> Void

    @State private var pick: NewTabPick
    @State private var prompt = ""
    @State private var detent: PresentationDetent

    init(project: Project, onOpen: @escaping (TerminalInfo) -> Void) {
        self.project = project
        self.onOpen = onOpen
        let pick = NewTabPick.load()
        _pick = State(initialValue: pick)
        _detent = State(initialValue: pick.agent.isEmpty ? .medium : .large)
    }

    private var options: [AgentOption]? { model.agentLaunch.options }
    private var agent: AgentOption? { options?.first { $0.id == pick.agent } }
    private var chosenModel: AgentModelOption? { agent?.models.first { $0.value == pick.model } }
    /// A remembered agent can't show as picked until the Mac says it still offers it.
    private var awaitingOptions: Bool { options == nil && !pick.agent.isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                startSection
                if let agent, !agent.models.isEmpty {
                    modelSection(agent)
                }
                if agent != nil {
                    Section {
                        TextField("Sent once the agent is ready", text: $prompt, axis: .vertical)
                            .lineLimit(2...6)
                    } header: {
                        SectionTitle(text: "First prompt")
                    }
                }
                if model.canResumeSessions(project) {
                    Section {
                        NavigationLink {
                            ResumeSessionList(project: project, onDone: { dismiss() }, onOpen: onOpen)
                                .onAppear { detent = .large }
                        } label: {
                            Label("Resume a Past Session…", systemImage: "clock.arrow.circlepath")
                        }
                    }
                }
            }
            .navigationTitle("New Tab")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Open", action: open).disabled(awaitingOptions)
                }
            }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .onAppear {
            if let options { pick = pick.resolved(in: options) }
            model.agentLaunch.loadOptions()
        }
        .onChange(of: options) { _, next in
            if let next { pick = pick.resolved(in: next) }
        }
        // An agent brings its model and prompt rows, so the sheet makes room for them.
        .onChange(of: pick.agent) { _, agent in
            if !agent.isEmpty { withAnimation { detent = .large } }
        }
    }

    private var startSection: some View {
        Section {
            NewTabStartRow(label: "Shell", agent: nil, picked: pick.agent.isEmpty) { pick = NewTabPick() }
            if let options {
                ForEach(options) { option in
                    NewTabStartRow(label: option.label, agent: option.id, picked: pick.agent == option.id) {
                        guard pick.agent != option.id else { return }
                        pick = NewTabPick(agent: option.id).choosing(model: "", effort: "", in: option)
                    }
                }
            } else {
                TerminalRowSkeleton()
            }
        } header: {
            SectionTitle(text: "Start")
        }
    }

    private func modelSection(_ agent: AgentOption) -> some View {
        Section {
            Picker("Model", selection: Binding(
                get: { pick.model },
                set: { pick = pick.choosing(model: $0, effort: pick.effort, in: agent) }
            )) {
                ForEach(agent.models) { Text($0.label).tag($0.value) }
            }
            .pickerStyle(.menu)
            if let chosenModel, chosenModel.efforts.count > 1 {
                Picker("Effort", selection: $pick.effort) {
                    ForEach(chosenModel.efforts) { Text($0.label).tag($0.value) }
                }
                .pickerStyle(.menu)
            }
        } header: {
            SectionTitle(text: "Model")
        } footer: {
            Text("Applies to this tab only.")
        }
    }

    private func open() {
        let picked = pick.resolved(in: options ?? [])
        picked.save()
        var launch = AgentLaunch(agent: picked.agent, model: picked.model, effort: picked.effort)
        if !picked.agent.isEmpty {
            launch.prompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        Haptics.tap()
        model.newTerminal(project.name, launch: launch, onSpawn: onOpen)
        dismiss()
    }
}
