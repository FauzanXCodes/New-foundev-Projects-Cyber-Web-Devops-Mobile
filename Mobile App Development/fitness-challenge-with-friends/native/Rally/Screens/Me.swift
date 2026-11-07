import Charts
import SwiftUI

struct MeView: View {
    @Environment(Router.self) private var router
    @State private var remote = Remote<MeData>("/me/summary")
    @Environment(\.dynamicTypeSize) private var dynamicType

    var body: some View {
        Page {
            if let data = remote.data {
                HStack(spacing: Metrics.gap) {
                    AvatarView(person: data.user.person, size: 56)
                    Text(data.user.name).font(.heading).lineLimit(1)
                    Spacer()
                }
                .settles(0)

                if let flair = data.user.flairDetail {
                    WearingCard(flair: flair).settles(1)
                }

                if let change = data.user.nameChange {
                    Button { router.me.append(.settings) } label: {
                        Card(tint: true) {
                            Text("\(change.by) picked your last name").font(.label)
                            Text("You're \(data.user.name) until \(Copy.shortDate(change.until)), from \(change.challengeName).")
                        }
                        .foregroundStyle(Palette.ink)
                    }
                    .buttonStyle(WaterButtonStyle())
                    .settles(1)
                }

                VStack(spacing: 6) {
                    if data.streak > 0 {
                        StreakDrop(streak: data.streak)
                        Text("📈 day streak").foregroundStyle(Palette.stone).accessibilityLabel("day streak")
                    } else {
                        SymbolArt(symbol: "flame.fill", size: 84)
                        Text("Start a streak today").font(.display).multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Metrics.gap)
                .settles(1)

                Group {
                    if dynamicType.isAccessibilitySize {
                        VStack(spacing: 8) { stats(data, stacked: true) }
                    } else {
                        HStack(spacing: 8) { stats(data, stacked: false) }.fixedSize(horizontal: false, vertical: true)
                    }
                }
                .settles(2)

                if let achievements = data.achievements {
                    AchievementGrid(achievements: achievements).flowsIn(2)
                }

                VStack(alignment: .leading, spacing: Metrics.gap) {
                    Text("What you track").font(.heading)
                    if data.tracked.isEmpty {
                        Button { router.me.append(.settings) } label: {
                            EmptyNote(symbol: "chart.bar.fill", text: "Pick what you want to track in settings.").foregroundStyle(Palette.ink)
                        }
                        .buttonStyle(WaterButtonStyle())
                    }
                    ForEach(data.tracked) { TrackedRow(item: $0).scrollLively() }
                }
                .settles(3)

                let medals = data.past.filter { $0.medal != nil }
                VStack(alignment: .leading, spacing: Metrics.gap) {
                    Text("Medals").font(.heading)
                    if medals.isEmpty {
                        Card {
                            HStack(spacing: Metrics.gap) {
                                MedalView(kind: .locked, emoji: "", size: 48)
                                Text("Reach your goal in a challenge to earn your first medal. Win it and it's gold.")
                            }
                        }
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: Metrics.gap) {
                                ForEach(Array(medals.enumerated()), id: \.offset) { i, p in
                                    Button { router.me.append(.challenge(p.id)) } label: {
                                        VStack(spacing: 8) {
                                            MedalView(kind: MedalView.kind(p.medal) ?? .goal, emoji: Catalog.emoji(p.type ?? "custom"), size: 66)
                                                .popIn(delay: 0.3 + Double(i) * 0.1)
                                            Text(p.name).font(.footnote.weight(.medium)).foregroundStyle(Palette.ink)
                                                .lineLimit(2).multilineTextAlignment(.center)
                                        }
                                        .frame(width: 92)
                                    }
                                    .buttonStyle(WaterButtonStyle())
                                    .accessibilityLabel("\(p.medal == "gold" ? "Gold medal" : "Medal"), \(p.name)")
                                }
                            }
                            .padding(.horizontal, Metrics.screen)
                            .padding(.vertical, 4)
                        }
                        .padding(.horizontal, -Metrics.screen)
                    }
                }
                .flowsIn(3)

                Button { router.me.append(.workouts) } label: {
                    HStack(spacing: Metrics.gap) {
                        EmojiBadge(emoji: "📒", size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Workout log").font(.headline)
                            Text("Everything you've logged, with your details.").font(.footnote).foregroundStyle(Palette.stone)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.faint)
                    }
                    .multilineTextAlignment(.leading)
                    .foregroundStyle(Palette.ink)
                    .padding(Metrics.card - 4)
                    .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
                }
                .buttonStyle(WaterButtonStyle())
                .settles(4)

                VStack(alignment: .leading, spacing: Metrics.gap) {
                    Text("Past challenges").font(.heading)
                    if data.past.isEmpty {
                        EmptyNote(symbol: "flag.checkered", text: "Finish a challenge and it shows up here.")
                    } else {
                        Card(padding: 0) {
                            ForEach(Array(data.past.enumerated()), id: \.offset) { i, p in
                                if i > 0 { Divider().padding(.leading, Metrics.card) }
                                Button { router.me.append(.challenge(p.id)) } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(p.name).font(.label)
                                            Text(p.rangeText).font(.footnote).foregroundStyle(Palette.stone)
                                        }
                                        Spacer()
                                        Text(Copy.resultEmoji(p.result)).accessibilityHidden(true)
                                        Text(p.result).font(.label)
                                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.faint)
                                    }
                                    .foregroundStyle(Palette.ink)
                                    .padding(.horizontal, Metrics.card)
                                    .frame(minHeight: 64)
                                    .contentShape(.rect)
                                }
                                .buttonStyle(WaterButtonStyle())
                                .accessibilityLabel("\(p.name), \(p.rangeText), \(p.result)")
                            }
                        }
                    }
                }
                .settles(4)
            } else {
                Waiting(error: remote.error, heights: [56, 90, 76, 92, 120]) { Task { await remote.load() } }
            }
        }
        .loads(remote)
        .onChange(of: remote.data?.achievements) { _, list in if let list { Achievements.announceNew(list) } }
        .onAppear { if let list = remote.data?.achievements { Achievements.announceNew(list) } }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Settings", systemImage: "gearshape.fill") { router.me.append(.settings) }
            }
        }
    }

    @ViewBuilder private func stats(_ d: MeData, stacked: Bool) -> some View {
        Stat(emoji: "✅", value: d.completed, label: "Challenges completed", stacked: stacked)
        Stat(emoji: "🏆", value: d.won, label: "Challenges won", stacked: stacked)
        Stat(emoji: "📈", value: d.longestStreak, label: "Longest streak", stacked: stacked)
    }
}

/** The badge you are wearing right now, why, and when it comes off. */
private struct WearingCard: View {
    var flair: FlairDetail
    private var reward: Bool { flair.kind == "reward" }

    var body: some View {
        HStack(spacing: Metrics.card) {
            Text(flair.emoji).font(.system(size: 44)).bobbing().accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(reward ? "You earned it" : "You're wearing it").font(.label).foregroundStyle(Palette.stone)
                Text(flair.title).font(.heading)
                Text(reward
                     ? "For winning \(flair.challengeName). Everyone sees it on your avatar until \(Copy.shortDate(flair.until))."
                     : "For coming up short in \(flair.challengeName). It's on your avatar until \(Copy.shortDate(flair.until)).")
                    .font(.subheadline)
            }
            Spacer(minLength: 0)
        }
        .padding(Metrics.card)
        .background(reward ? AnyShapeStyle(LinearGradient(colors: [Color(red: 1, green: 0.87, blue: 0.42).opacity(0.28), Palette.card], startPoint: .topLeading, endPoint: .bottomTrailing)) : AnyShapeStyle(Palette.signalTint),
                    in: .rect(cornerRadius: Metrics.radius))
        .accessibilityElement(children: .combine)
    }
}

/** Every achievement medal: the ones you have, struck and bright, and the ones still to earn with how far along you are. */
private struct AchievementGrid: View {
    var achievements: [Achievement]
    private var ordered: [Achievement] { achievements.filter(\.earned) + achievements.filter { !$0.earned }.sorted { $0.progress > $1.progress } }

    var body: some View {
        let earned = achievements.filter(\.earned).count
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Achievements").font(.heading)
                Spacer()
                Text("\(earned) of \(achievements.count)").font(.label).foregroundStyle(Palette.stone)
            }
            // One row to swipe through. Tap a medal for what it takes and how far along you are.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 6) {
                    ForEach(ordered) { a in
                        Button {
                            Toaster.shared.show(Toast(emoji: a.emoji, title: a.title, detail: a.earned ? "\(a.text) Earned." : "\(a.text) \(a.progressText).", seconds: 4))
                        } label: {
                            VStack(spacing: 4) {
                                MedalView(kind: a.earned ? (a.gold ? .gold : .goal) : .locked, emoji: a.emoji, size: 40)
                                Text(a.title).font(.caption2.weight(.medium)).foregroundStyle(a.earned ? Palette.ink : Palette.stone)
                                    .lineLimit(1)
                            }
                            .frame(width: 68)
                        }
                        .buttonStyle(WaterButtonStyle())
                        .accessibilityLabel("\(a.title). \(a.earned ? "Earned" : a.progressText). \(a.text)")
                    }
                }
            }
            .scrollClipDisabled()
        }
    }
}

/** The streak number in a drop of water that keeps gently rippling. */
private struct StreakDrop: View {
    var streak: Int
    @State private var level = 0.0

    var body: some View {
        WaterCircle(level: level, size: 92) {
            Text("\(streak)")
                .font(.system(size: 38, weight: .bold, design: .rounded))
                .foregroundStyle(Palette.ink)
                .contentTransition(.numericText())
        }
        .onAppear { withAnimation(.easeOut(duration: 1.4)) { level = 0.34 } }
        .accessibilityElement()
        .accessibilityLabel("\(streak) day streak")
    }
}

private struct Stat: View {
    var emoji: String
    var value: Int
    var label: String
    var stacked: Bool

    var body: some View {
        Group {
            if stacked {
                HStack {
                    Text(emoji).accessibilityHidden(true)
                    Text("\(value)").font(.heading)
                    Spacer()
                    Text(label).font(.footnote).foregroundStyle(Palette.stone)
                }
            } else {
                VStack(spacing: 2) {
                    Text(emoji).font(.title3).accessibilityHidden(true)
                    CountUp(value: value).font(.heading)
                    Text(label).font(.footnote).foregroundStyle(Palette.stone).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, stacked ? Metrics.card : 8)
        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        .accessibilityElement(children: .combine)
    }
}

private struct TrackedRow: View {
    var item: TrackedCard
    private let letters = ["M", "T", "W", "T", "F", "S", "S"]
    @State private var grown = false

    var body: some View {
        Card {
            HStack(spacing: Metrics.gap) {
                EmojiBadge(emoji: Catalog.emoji(item.type), size: 40).popIn(delay: 0.3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.label).font(.label).foregroundStyle(Palette.stone)
                    Text(item.totalText).font(.heading).minimumScaleFactor(0.8)
                }
                .layoutPriority(1)
                Spacer(minLength: 8)
                Chart(Array(item.days.enumerated()), id: \.offset) { i, d in
                    BarMark(x: .value("Day", "\(i)"), y: .value("Amount", grown ? max(d ?? 0, 0.0001) : 0.0001), width: 10)
                        .foregroundStyle(i == item.todayIndex ? Palette.accent : (d ?? 0) > 0 ? Palette.ink : Palette.track)
                        .clipShape(Capsule())
                }
                .chartXAxis {
                    AxisMarks { v in
                        AxisValueLabel {
                            if let i = v.as(String.self).flatMap(Int.init) { Text(letters[i % 7]).font(.caption2) }
                        }
                    }
                }
                .chartYAxis(.hidden)
                .chartYScale(domain: 0...(max(item.days.compactMap { $0 }.max() ?? 1, 1)))
                .frame(width: 112, height: 62)
                .accessibilityHidden(true)
            }
        }
        .onAppear { withAnimation(Motion.wave.delay(0.2)) { grown = true } }
    }
}

struct SettingsView: View {
    @Environment(API.self) private var api
    @State private var remote = Remote<Me>("/me")
    @AppStorage(Appearance.key) private var appearance = Appearance.fallback.rawValue
    @State private var name: String?
    @State private var time = "07:00"
    @State private var error: String?
    @State private var phoneSheet = false
    @State private var confirmLogout = false

    var body: some View {
        Group {
            if let me = remote.data {
                form(me)
            } else {
                Page { Waiting(error: remote.error, heights: [40, 90, 90, 90]) { Task { await remote.load() } } }
            }
        }
        .navigationTitle("Settings")
        .loads(remote)
    }

    private func form(_ me: Me) -> some View {
        Form {
            Section {
                Picker(selection: $appearance) {
                    ForEach(AppearanceChoice.allCases) { c in
                        Label(c.label, systemImage: c.symbol).tag(c.rawValue)
                    }
                } label: {
                    Label("Appearance", systemImage: "circle.lefthalf.filled")
                }
                .pickerStyle(.inline)
                .labelsHidden()
                .sensoryFeedback(.selection, trigger: appearance)
            } header: {
                Text("Appearance")
            } footer: {
                Text("Match iPhone follows Dark Mode in your iPhone's settings.")
            }

            Section("Name") {
                TextField("Name", text: Binding(get: { name ?? me.name }, set: { name = $0 }))
                    .textInputAutocapitalization(.words)
                    .disabled(me.nameChange != nil)
                    .onSubmit { saveName(me) }
                if let change = me.nameChange {
                    Text("\(change.by) picked your last name after \(change.challengeName). It goes back on its own on \(Copy.shortDate(change.until)).")
                        .font(.footnote).foregroundStyle(Palette.stone)
                    Button("Change it back now") { Task { await resetName() } }
                }
            }

            Section("Workout reminder") {
                Picker("Time", selection: $time) {
                    ForEach(Catalog.times, id: \.self) { Text(Catalog.timeLabel($0)).tag($0) }
                }
                .onChange(of: time) { _, v in if v != me.workoutTime { save(["workoutTime": v]) } }
                Toggle("Daily reminder", isOn: Binding(get: { me.notifications }, set: { save(["notifications": $0]) }))
            }

            Section {
                ForEach(Catalog.trackTypes, id: \.self) { t in
                    let on = me.trackedTypes.contains(t)
                    Button {
                        var next = me.trackedTypes
                        if on { next.removeAll { $0 == t } } else if next.count < 3 { next.append(t) }
                        if !next.isEmpty, next != me.trackedTypes { save(["trackedTypes": next]) }
                    } label: {
                        HStack {
                            Label(Catalog.info(t).label, systemImage: Catalog.info(t).symbol).foregroundStyle(Palette.ink)
                            Spacer()
                            if on { Image(systemName: "checkmark").foregroundStyle(Palette.accent).transition(.scale.combined(with: .opacity)) }
                        }
                    }
                    .animation(Motion.splash, value: on)
                }
            } header: {
                Text("What you track")
            } footer: {
                Text("Pick up to three.")
            }

            Section {
                Picker("How active are you", selection: Binding(get: { me.band }, set: { save(["band": $0]) })) {
                    ForEach(Catalog.bands, id: \.key) { Text($0.label).tag($0.key) }
                }
            } footer: {
                Text("Sets your own step and mile goals in fair play challenges.")
            }

            if StepSync.shared.available {
                Section {
                    Toggle("Count my steps automatically", isOn: Binding(get: { StepSync.shared.enabled }, set: { StepSync.shared.enabled = $0 }))
                    if let today = StepSync.shared.today, StepSync.shared.enabled {
                        LabeledContent("Today", value: "\(Catalog.fmt(Double(today))) steps")
                    }
                } header: {
                    Text("Steps")
                } footer: {
                    Text(StepSync.shared.denied
                         ? "Rally isn't allowed to read steps. Turn on Motion & Fitness for Rally in the iPhone's Settings app."
                         : "Your iPhone counts steps on its own. With this on, today's count goes into your steps challenges each time you open Rally, so there's nothing to type.")
                }
            }

            Section("Sign-in phone") {
                if me.hasPin {
                    LabeledContent("Phone", value: formatPhone(me.phone ?? ""))
                    Button("Change PIN") { phoneSheet = true }
                } else {
                    Text("Add a phone number and PIN so you can sign in on a new phone.").foregroundStyle(Palette.stone)
                    Button("Add a PIN") { phoneSheet = true }
                }
            }

            if let error { Section { ErrorLine(text: error) } }

            Section {
                Button("Log out", role: .destructive) { confirmLogout = true }
            }
        }
        .scrollContentBackground(.hidden)
        .background { WaterBackdrop(strength: 0.1) }
        .onAppear { time = me.workoutTime }
        .sheet(isPresented: $phoneSheet) {
            PhonePinSheet(initial: me.phone ?? "") { remote.data = $0 }
        }
        .confirmationDialog("Log out?", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("Log out", role: .destructive) {
                Task {
                    await Reminders.schedule(enabled: false, time: me.workoutTime, friend: nil)
                    api.setSession(nil)
                }
            }
            if !me.hasPin { Button("Add a PIN first") { phoneSheet = true } }
            Button("Stay logged in", role: .cancel) {}
        } message: {
            Text(me.hasPin
                 ? "You can sign back in with your phone and PIN, or Face ID on this phone."
                 : "You haven't added a phone and PIN, so logging out means starting over unless this phone still remembers you.")
        }
    }

    private func formatPhone(_ d: String) -> String {
        guard d.count == 10 else { return d }
        let a = Array(d)
        return "(\(String(a[0..<3]))) \(String(a[3..<6]))-\(String(a[6...]))"
    }

    private func saveName(_ me: Me) {
        guard let n = name?.trimmed, !n.isEmpty, n != me.name else { return }
        save(["name": n])
    }

    private func save(_ patch: [String: Any]) {
        Task {
            error = nil
            do {
                let next: Me = try await api.send("/me", method: "PATCH", body: patch)
                withAnimation(Motion.fluid) { remote.data = next }
                if patch["workoutTime"] != nil || patch["notifications"] != nil {
                    await Reminders.schedule(enabled: next.notifications, time: next.workoutTime, friend: nil, ask: patch["notifications"] as? Bool == true)
                }
            } catch {
                withAnimation(Motion.fluid) { self.error = error.localizedDescription }
            }
        }
    }

    private func resetName() async {
        do {
            let next: Me = try await api.send("/me/name/reset", body: [:])
            withAnimation(Motion.fluid) {
                remote.data = next
                name = nil
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct PhonePinSheet: View {
    var initial: String
    var saved: (Me) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var phone = ""
    @State private var pin = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: Metrics.gap * 1.5) {
                Text("Sign-in phone and PIN").font(.heading).frame(maxWidth: .infinity, alignment: .leading)
                RallyField(placeholder: "(555) 010-2030", text: $phone, keyboard: .phonePad, maxLength: 20)
                PinPad(value: $pin)
                ErrorLine(text: error)
                PrimaryButton(title: "Save", busy: busy, disabled: phone.filter(\.isNumber).count != 10 || pin.count != 4) {
                    Task {
                        busy = true
                        do {
                            let next: Me = try await api.send("/me", method: "PATCH", body: ["phone": phone.filter(\.isNumber), "pin": pin])
                            saved(next)
                            Haptic.success()
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
        .presentationDetents([.large])
        .onAppear { phone = initial }
    }
}
