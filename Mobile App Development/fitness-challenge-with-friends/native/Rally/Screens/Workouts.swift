import SwiftUI

// The detail on a workout (how long, what exactly, a note, who can see it) and the log of everything
// you have recorded. All of it is optional: logging stays one tap for anyone who wants it that way.

struct ExerciseDraft: Identifiable, Hashable {
    let id = UUID()
    var name = ""
    var sets = ""
    var reps = ""
    var weight = ""
}

struct WorkoutDraft: Hashable {
    var minutes = 0
    var note = ""
    var exercises: [ExerciseDraft] = []
    /** Off means private, which is where it starts. */
    var shared = false
    /** The specific workout picked while logging, and how much of its own measure. Not changed by editing later. */
    var workout: String?
    var amount = ""

    var amountValue: Double? {
        guard let n = Double(amount.replacingOccurrences(of: ",", with: ".")), n > 0 else { return nil }
        return n
    }

    init() {}

    init(_ w: Workout) {
        minutes = w.minutes ?? 0
        note = w.note
        shared = w.shared
        exercises = w.exercises.map {
            ExerciseDraft(name: $0.name, sets: $0.sets.map(String.init) ?? "", reps: $0.reps.map(String.init) ?? "",
                          weight: $0.weight.map { Catalog.fmt($0).replacingOccurrences(of: ",", with: "") } ?? "")
        }
    }

    /** Nothing typed into the optional details. The workout picked above them does not count. */
    var isEmpty: Bool { minutes == 0 && note.trimmed.isEmpty && exercises.allSatisfy { $0.name.trimmed.isEmpty } && !shared }
    var nothingToSend: Bool { isEmpty && workout == nil }

    /** What the server takes. */
    var payload: [String: Any] {
        var out: [String: Any] = ["note": note.trimmed, "shared": shared]
        if minutes > 0 { out["minutes"] = minutes }
        if let workout {
            out["workout"] = workout
            if let amountValue { out["amount"] = amountValue }
        }
        out["exercises"] = exercises.filter { !$0.name.trimmed.isEmpty }.map { e -> [String: Any] in
            var row: [String: Any] = ["name": e.name.trimmed]
            if let n = Int(e.sets) { row["sets"] = n }
            if let n = Int(e.reps) { row["reps"] = n }
            if let n = Double(e.weight.replacingOccurrences(of: ",", with: ".")) { row["weight"] = n }
            return row
        }
        return out
    }
}

/** The fields for a workout's detail. Used while logging and when editing one later. */
struct WorkoutDetailFields: View {
    @Binding var draft: WorkoutDraft
    private let lengths = [0] + Array(stride(from: 5, through: 180, by: 5))

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            HStack {
                Label("How long", systemImage: "clock")
                Spacer()
                Picker("How long", selection: $draft.minutes) {
                    ForEach(lengths, id: \.self) { m in Text(m == 0 ? "Not set" : "\(m) min").tag(m) }
                }
                .pickerStyle(.menu)
                .tint(Palette.accent)
            }
            .font(.label)

            VStack(alignment: .leading, spacing: 8) {
                Label("Exercises", systemImage: "dumbbell").font(.label)
                ForEach($draft.exercises) { $e in
                    VStack(spacing: 6) {
                        HStack {
                            TextField("Exercise, like Squat", text: $e.name)
                                .textInputAutocapitalization(.words)
                            Button {
                                withAnimation(Motion.fluid) { draft.exercises.removeAll { $0.id == e.id } }
                            } label: {
                                Image(systemName: "minus.circle.fill").foregroundStyle(Palette.stone)
                            }
                            .accessibilityLabel("Remove exercise")
                        }
                        HStack(spacing: 8) {
                            small("Sets", $e.sets, .numberPad)
                            small("Reps", $e.reps, .numberPad)
                            small("Weight", $e.weight, .decimalPad)
                        }
                    }
                    .padding(12)
                    .background(Palette.inset, in: .rect(cornerRadius: 14))
                    .transition(.liquid)
                }
                Button {
                    Haptic.tap()
                    withAnimation(Motion.fluid) { draft.exercises.append(ExerciseDraft()) }
                } label: {
                    Label("Add an exercise", systemImage: "plus.circle.fill").font(.label)
                }
                .tint(Palette.accent)
            }

            TextField("Note, if you want one", text: $draft.note, axis: .vertical)
                .lineLimit(1...4)
                .padding(12)
                .background(Palette.inset, in: .rect(cornerRadius: 14))

            Toggle(isOn: $draft.shared) {
                VStack(alignment: .leading, spacing: 2) {
                    Label(draft.shared ? "Shared with your crew" : "Private", systemImage: draft.shared ? "person.2.fill" : "lock.fill").font(.label)
                    Text(draft.shared ? "Your crew can see this workout's details." : "Only you can see these details.")
                        .font(.footnote).foregroundStyle(Palette.stone)
                }
            }
            .tint(Palette.signal)
        }
    }

    private func small(_ title: String, _ text: Binding<String>, _ keyboard: UIKeyboardType) -> some View {
        VStack(spacing: 3) {
            TextField("0", text: text)
                .keyboardType(keyboard)
                .multilineTextAlignment(.center)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(Palette.card, in: .rect(cornerRadius: 10))
                .accessibilityLabel(title)
            // Always visible, so a filled-in row still says which number is which.
            Text(title == "Weight" ? "Weight (lb)" : title).font(.caption2).foregroundStyle(Palette.stone)
        }
    }
}

/** One workout, as a row: what, when, and whatever detail it has. */
struct WorkoutRow: View {
    var workout: Workout
    var showsPrivacy = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: Metrics.gap) {
                EmojiBadge(emoji: workout.emoji, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(workout.title).font(.headline)
                    Text(workout.dateText).font(.footnote).foregroundStyle(Palette.stone)
                }
                Spacer(minLength: 0)
                if let metric = workout.metricText, !metric.hasSuffix(" min") {
                    Text(metric).font(.footnote.weight(.semibold))
                }
                if let m = workout.minutes {
                    Label("\(m) min", systemImage: "clock").font(.footnote.weight(.medium)).foregroundStyle(Palette.stone)
                }
                if showsPrivacy {
                    Image(systemName: workout.shared ? "person.2.fill" : "lock.fill")
                        .font(.footnote)
                        .foregroundStyle(workout.shared ? Palette.accent : Palette.faint)
                        .accessibilityLabel(workout.shared ? "Shared with your crew" : "Private")
                }
            }
            ForEach(workout.exercises, id: \.self) { e in
                HStack {
                    Text(e.name).font(.subheadline)
                    Spacer()
                    Text(e.summary).font(.subheadline.weight(.medium)).foregroundStyle(Palette.stone)
                }
            }
            if !workout.note.isEmpty { Text(workout.note).font(.subheadline).foregroundStyle(Palette.stone) }
            if !workout.countedToward.isEmpty {
                Text("Counted toward \(workout.countedToward.joined(separator: ", "))").font(.footnote).foregroundStyle(Palette.faint)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Metrics.card - 4)
        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
    }
}

/** Everything you have logged, newest first. Tap one to add or change its details. */
struct WorkoutLogView: View {
    @State private var remote = Remote<[Workout]>("/workouts")
    @State private var editing: Workout?

    var body: some View {
        Page {
            Text("Workout log").font(.display).settles(0)
            if let workouts = remote.data {
                if workouts.isEmpty {
                    EmptyNote(symbol: "list.bullet.clipboard", text: "Log a workout and it shows up here, with any details you add.").settles(1)
                }
                ForEach(Array(workouts.enumerated()), id: \.element.id) { i, w in
                    Button { editing = w } label: { WorkoutRow(workout: w).foregroundStyle(Palette.ink) }
                        .buttonStyle(WaterButtonStyle())
                        .scrollLively()
                        .settles(min(i, 6) + 1)
                        .accessibilityHint("Opens this workout's details")
                }
            } else {
                Waiting(error: remote.error, heights: [40, 90, 90, 90]) { Task { await remote.load() } }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .loads(remote)
        .sheet(item: $editing) { w in
            WorkoutEditSheet(workout: w) { updated in
                if let i = remote.data?.firstIndex(where: { $0.id == updated.id }) {
                    withAnimation(Motion.fluid) { remote.data?[i] = updated }
                }
            }
        }
    }
}

private struct WorkoutEditSheet: View {
    var workout: Workout
    var saved: (Workout) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var draft = WorkoutDraft()
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Metrics.gap * 1.5) {
                    HStack(spacing: Metrics.gap) {
                        EmojiBadge(emoji: workout.emoji)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(workout.metricText.map { "\(workout.title), \($0)" } ?? workout.title).font(.heading)
                            Text(workout.dateText).font(.footnote).foregroundStyle(Palette.stone)
                        }
                    }
                    WorkoutDetailFields(draft: $draft)
                    ErrorLine(text: error)
                    PrimaryButton(title: "Save", busy: busy) {
                        Task {
                            busy = true
                            do {
                                let updated: Workout = try await api.send("/workouts/\(workout.id)", method: "PATCH", body: draft.payload)
                                saved(updated)
                                Toaster.shared.confirm("✅", "Workout saved")
                                dismiss()
                            } catch {
                                self.error = error.localizedDescription
                            }
                            busy = false
                        }
                    }
                }
                .padding(Metrics.screen)
            }
            .scrollDismissesKeyboard(.interactively)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close", systemImage: "xmark") { dismiss() } } }
        }
        .onAppear { draft = WorkoutDraft(workout) }
    }
}
