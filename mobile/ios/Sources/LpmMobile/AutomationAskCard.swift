import SwiftUI

/// A question an automation put to the user: the form to answer it while it is
/// open, then what became of it. `framed` draws its own card, for the
/// conversation; in a list the row is the frame.
struct AutomationAskCard: View {
    @Environment(AppModel.self) private var model
    let ask: AutomationAsk
    /// Where the automation waits — the project the answer goes to.
    let project: String
    let jobId: String
    var framed = true

    @State private var drafts: [String: AutomationAskDraft] = [:]

    private var key: String { model.automationKey(project, jobId) }
    private var busy: Bool { model.automationPending.contains(key) }
    private var tint: Color { ask.isOpen ? .orange : .secondary }

    var body: some View {
        if framed {
            content
                .padding(14)
                .background(tint.opacity(ask.isOpen ? 0.08 : 0), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(tint.opacity(ask.isOpen ? 0.5 : 0.25))
                )
        } else {
            content.padding(.vertical, 4)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Circle().fill(tint).frame(width: 7, height: 7)
                Text(ask.statusLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(ask.isOpen ? Color.orange : Color.secondary)
                Spacer(minLength: 8)
                Text(when)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if ask.isOpen { form } else { summary }
        }
    }

    private var when: String {
        if ask.isOpen {
            let deadline = automationAskDeadline(ask)
            return deadline.isEmpty ? automationClockText(ask.askedAt) : deadline
        }
        return automationClockText(ask.answeredAt ?? ask.askedAt)
    }

    // MARK: Open

    private var form: some View {
        let state = automationAskAnswers(ask.questions, drafts)
        return VStack(alignment: .leading, spacing: 14) {
            ForEach(ask.questions) { q in
                VStack(alignment: .leading, spacing: 8) {
                    Text(q.text)
                        .font(.subheadline.weight(.semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    if let d = q.defaultAnswer {
                        Text("Default: \(automationAskDisplay(q, d))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    field(q)
                }
            }
            HStack(spacing: 12) {
                if let error = model.automationAskError[key] {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Button("Dismiss") {
                    model.dismissAutomationQuestion(project: project, jobId: jobId, askId: ask.id)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)
                .disabled(busy)
                if !ask.answersOnTap {
                    Button("Send answer") { send(state.answers) }
                        .buttonStyle(.borderedProminent)
                        .disabled(busy || state.missing != nil)
                }
            }
            .font(.subheadline)
        }
    }

    @ViewBuilder
    private func field(_ q: AutomationAskQuestion) -> some View {
        let draft = Binding(
            get: { drafts[q.id] ?? AutomationAskDraft() },
            set: { drafts[q.id] = $0 }
        )
        switch q.type {
        case "confirm":
            HStack(spacing: 10) {
                confirmButton(q, draft: draft, value: "yes", label: q.yesLabel)
                confirmButton(q, draft: draft, value: "no", label: q.noLabel)
            }
        case "choice":
            VStack(alignment: .leading, spacing: 6) {
                ForEach(q.options, id: \.self) { option in
                    choiceRow(q, draft: draft, option: option)
                }
                if q.other {
                    TextField("Something else…", text: Binding(
                        get: { draft.wrappedValue.other },
                        set: { value in
                            var next = draft.wrappedValue
                            next.other = value
                            if !q.multiple, !value.isEmpty { next.picks = [] }
                            draft.wrappedValue = next
                        }
                    ))
                    .textFieldStyle(.roundedBorder)
                }
            }
        default:
            TextField(q.placeholder.isEmpty ? "Your answer" : q.placeholder,
                      text: Binding(get: { draft.wrappedValue.text },
                                    set: { draft.wrappedValue.text = $0 }),
                      axis: .vertical)
                .lineLimit(q.multiline ? 3...8 : 1...4)
                .textFieldStyle(.roundedBorder)
        }
    }

    private func confirmButton(_ q: AutomationAskQuestion, draft: Binding<AutomationAskDraft>,
                               value: String, label: String) -> some View {
        let picked = draft.wrappedValue.picks.first == value
        return Button {
            Haptics.tap()
            if ask.answersOnTap {
                send([q.id: value == "yes"])
            } else {
                draft.wrappedValue.picks = picked ? [] : [value]
            }
        } label: {
            Text(label)
                .font(.subheadline.weight(.medium))
                .frame(minWidth: 72)
        }
        .buttonStyle(.bordered)
        .tint(picked ? .accentColor : .primary)
        .disabled(busy)
    }

    private func choiceRow(_ q: AutomationAskQuestion, draft: Binding<AutomationAskDraft>,
                           option: AutomationAskOption) -> some View {
        let picked = draft.wrappedValue.picks.contains(option.label)
        let mark = q.multiple
            ? (picked ? "checkmark.square.fill" : "square")
            : (picked ? "checkmark.circle.fill" : "circle")
        return Button {
            draft.wrappedValue = automationAskToggle(q, draft.wrappedValue, option.label)
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: mark)
                    .foregroundStyle(picked ? Color.accentColor : Color.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.label).foregroundStyle(.primary)
                    if !option.description.isEmpty {
                        Text(option.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(picked ? Color.accentColor : Color.secondary.opacity(0.3))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(picked ? .isSelected : [])
        .disabled(busy)
    }

    private func send(_ answers: [String: Any]) {
        model.answerAutomationQuestion(project: project, jobId: jobId, askId: ask.id, answers: answers)
    }

    // MARK: Closed

    private var summary: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(ask.questions) { q in
                let answer = automationAskDisplay(q, ask.answers[q.id])
                (Text(q.text).foregroundStyle(answer.isEmpty ? Color.secondary : Color.primary.opacity(0.75))
                    + Text(answer.isEmpty ? "" : " → ")
                    + Text(answer).fontWeight(.semibold))
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
