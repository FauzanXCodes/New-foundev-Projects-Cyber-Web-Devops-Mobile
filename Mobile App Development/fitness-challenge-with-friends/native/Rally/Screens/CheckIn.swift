import SwiftUI

struct CheckInView: View {
    @State private var remote = Remote<CheckinData>("/checkin")
    // Keeps the "Logged" screen up until Done, even though today now counts as checked in.
    @State private var holding = false
    @State private var round = 0
    @State private var level = 0.0
    @State private var party = 0
    @State private var justLogged = false

    var body: some View {
        Group {
            if let data = remote.data {
                if data.checkedIn && !holding {
                    VStack(spacing: Metrics.gap * 2) {
                        Text(Catalog.longDate(Catalog.localDate())).font(.footnote).foregroundStyle(Palette.stone)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Spacer()
                        WaterCircle(level: level, size: 140) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 60, weight: .bold))
                                .foregroundStyle(.white)
                                .symbolEffect(.bounce, value: level > 0.5)
                        }
                        Text("You're in for today 🎉").font(.display).multilineTextAlignment(.center)
                            .accessibilityLabel("You're in for today")
                        HStack(spacing: 6) {
                            Text("📈").accessibilityHidden(true)
                            CountUp(value: data.streak)
                            Text(data.streak == 1 ? "day streak" : "day streak")
                        }
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Palette.stone)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(data.streak) day streak")
                        Spacer()
                        // The day's part is done: something small and interesting as a thank-you.
                        FunFactCard()
                        Spacer()
                    }
                    .padding(Metrics.screen)
                    .background {
                        WaterBackdrop()
                        FloatingEmoji(emoji: ["💪", "🔥", "🎉", "⭐️", "👟"], opacity: 0.35)
                    }
                    .overlay { ConfettiBurst(trigger: party) }
                    .onAppear {
                        level = 0
                        withAnimation(.easeOut(duration: 1.4)) { level = 1 }
                        // Only right after logging, not every time the tab is opened.
                        if justLogged {
                            justLogged = false
                            let streak = data.streak
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { Nudges.streakReached(streak) }
                            Task {
                                try? await Task.sleep(for: .seconds(3.5))
                                await Achievements.check()
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { party += 1 }
                        }
                    }
                    .transition(.liquid)
                } else {
                    LogFlow(data: data, preset: nil, onLogged: { holding = true; justLogged = true }, onFinish: {
                        Task {
                            await remote.load()
                            withAnimation(Motion.wave) {
                                holding = false
                                round += 1
                            }
                        }
                    })
                    .id(round)
                    .transition(.liquid)
                }
            } else {
                Page { Waiting(error: remote.error, heights: [34, 260]) { Task { await remote.load() } } }
            }
        }
        .animation(Motion.wave, value: remote.data?.checkedIn)
        .loads(remote)
        .toolbar(.hidden, for: .navigationBar)
    }
}

/** Log today from a challenge: the same flow, counting toward that challenge from the start. */
struct LogSheet: View {
    var challengeId: String
    @State private var remote = Remote<CheckinData>("/checkin")
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let data = remote.data {
                    LogFlow(data: data, preset: challengeId, onFinish: { dismiss() }, onNotToday: { dismiss() })
                } else {
                    Page { Waiting(error: remote.error, heights: [34, 200]) { Task { await remote.load() } } }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .task { await remote.load() }
    }
}

/** Yes or no, what you did, which challenges it counts toward, how many if numeric, log it. */
struct LogFlow: View {
    var data: CheckinData
    var preset: String?
    var onLogged: () -> Void = {}
    var onFinish: () -> Void
    var onNotToday: (() -> Void)? = nil
    /** Debug only: opens at "what did you do" with a trail run filled in. */
    var demo = false

    private enum Phase { case ask, what, no, logged }

    @Environment(API.self) private var api
    @State private var phase = Phase.ask
    @State private var activity: String?
    @State private var picked: [String] = []
    @State private var pickedByHand = false
    @State private var amounts: [String: Double] = ["steps": 6000, "miles": 2, "minutes": 30]
    @State private var result: CheckinResult?
    @State private var busy = false
    @State private var error: String?
    @State private var party = 0
    @State private var details = WorkoutDraft()
    @State private var showDetails = false

    private var open: [CheckinChallenge] { data.challenges.filter { !$0.loggedToday } }
    private var chosen: [CheckinChallenge] { open.filter { picked.contains($0.id) } }
    /** The specific workouts under the activity picked, and the one chosen. */
    private var kinds: [WorkoutOption] { (data.workouts ?? []).filter { $0.activity == activity } }
    private var kind: WorkoutOption? { kinds.first { $0.key == details.workout } }

    /** The exact number the workout already gave for a challenge type, so it is not asked for twice. */
    private func measured(_ type: String) -> Double? {
        guard let kind, let n = details.amountValue, n <= kind.max else { return nil }
        return (type == "miles" && kind.unit == "mi") || (type == "minutes" && kind.unit == "min") ? n : nil
    }

    private var numericTypes: [String] {
        var seen: [String] = []
        for c in chosen where c.numeric && !seen.contains(c.type) && measured(c.type) == nil { seen.append(c.type) }
        return seen
    }

    var body: some View {
        Page {
            Text(Catalog.longDate(Catalog.localDate())).font(.footnote).foregroundStyle(Palette.stone)
            Group {
                switch phase {
                case .ask: ask
                case .no: no
                case .what: what
                case .logged: logged
                }
            }
            .transition(.liquid)
        } footer: {
            footer
        }
        .overlay { ConfettiBurst(trigger: party, emoji: ["🎉", "💪", kind?.emoji ?? Catalog.emoji(activity ?? "other")]) }
        .animation(Motion.wave, value: phase)
        .onAppear {
            if let preset, picked.isEmpty {
                picked = [preset]
                pickedByHand = true
            }
            if demo, phase == .ask {
                phase = .what
                activity = "run"
                details.workout = "trail_run"
                details.amount = "3.4"
                carryMetric()
            }
        }
    }

    // ---------- phases ----------

    private var ask: some View {
        VStack(spacing: Metrics.gap * 2) {
            Text("Did you work out today? 💪").font(.display).multilineTextAlignment(.center).frame(maxWidth: .infinity)
                .accessibilityLabel("Did you work out today?")
            SwipeCard { yes in
                withAnimation(Motion.wave) { phase = yes ? .what : .no }
            }
        }
    }

    private var no: some View {
        Card {
            let early = Calendar.current.component(.hour, from: .now) < 18
            VStack(spacing: Metrics.gap) {
                Text(early ? "⏰" : "😴").font(.system(size: 64)).accessibilityHidden(true)
                Text(early ? "There's still time today." : "All right. We lock in tomorrow.")
                    .font(.heading)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: 240)
        }
    }

    private var what: some View {
        Card {
            Text("Nice. What did you do? 🙌").font(.heading).accessibilityLabel("Nice. What did you do?")
            ChipPicker(options: Catalog.activities.map { ChipOption(id: $0.key, label: $0.label, emoji: Catalog.emoji($0.key)) }, selection: activity) { choose($0) }
            if !kinds.isEmpty {
                Text("Which kind?").font(.label).padding(.top, 8)
                ChipPicker(options: kinds.map { ChipOption(id: $0.key, label: $0.label, emoji: $0.emoji) }, selection: details.workout) { key in
                    withAnimation(Motion.fluid) {
                        details.workout = details.workout == key ? nil : key
                        details.amount = ""
                    }
                }
                .transition(.liquid)
            }
            if let kind {
                // Each workout is measured its own way: a swim in laps, a hike in miles, yoga in minutes.
                HStack(spacing: Metrics.gap) {
                    Text("\(kind.emoji) \(kind.ask)").font(.label)
                    Spacer(minLength: 0)
                    TextField("0", text: $details.amount)
                        .keyboardType(kind.whole ? .numberPad : .decimalPad)
                        .multilineTextAlignment(.trailing)
                        .font(.title3.weight(.semibold))
                        .frame(width: 90)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(Palette.inset, in: .rect(cornerRadius: 12))
                        .accessibilityLabel(kind.ask)
                    Text(kind.unit).font(.label).foregroundStyle(Palette.stone)
                }
                .padding(.top, 8)
                .transition(.liquid)
                .onChange(of: details.amount) { _, _ in carryMetric() }
            }
            if !data.challenges.isEmpty {
                Text("Count it toward").font(.label).padding(.top, 8)
                MultiChipPicker(
                    options: data.challenges.map { ChipOption(id: $0.id, label: $0.loggedToday ? "\($0.name), done today" : $0.name, emoji: $0.loggedToday ? "✅" : Catalog.emoji($0.type), disabled: $0.loggedToday) },
                    selection: Binding(get: { picked }, set: { picked = $0; pickedByHand = true }))
            }
            ForEach(numericTypes, id: \.self) { t in
                VStack(alignment: .leading, spacing: 8) {
                    Text("How many \(Catalog.info(t).many)?").font(.label)
                    WheelPicker(
                        label: "How many \(Catalog.info(t).many)",
                        values: Catalog.logOptions(t),
                        value: Binding(get: { amounts[t] ?? Catalog.logOptions(t)[0] }, set: { amounts[t] = $0 }),
                        format: Catalog.fmt)
                }
                .padding(.top, 8)
                .transition(.liquid)
            }
            // Optional, and folded away: logging stays one tap for anyone who does not want more.
            DisclosureGroup(isExpanded: $showDetails) {
                WorkoutDetailFields(draft: $details).padding(.top, 8)
            } label: {
                Label(details.isEmpty ? "Add details" : "Details added", systemImage: details.isEmpty ? "square.and.pencil" : "checkmark.circle.fill")
                    .font(.label)
                    .foregroundStyle(details.isEmpty ? Palette.ink : Palette.done)
            }
            .tint(Palette.stone)
            .padding(.top, 8)
            ErrorLine(text: error)
        }
        .animation(Motion.fluid, value: numericTypes)
        .animation(Motion.fluid, value: activity)
        .animation(Motion.fluid, value: showDetails)
    }

    @ViewBuilder private var logged: some View {
        if let result {
            ForEach(Array(result.cards.enumerated()), id: \.element.id) { i, c in
                ChallengeCardView(card: c, from: result.previous[c.id]).settles(i)
            }
            HStack(alignment: .top, spacing: Metrics.gap) {
                Text("🎉").font(.title).accessibilityHidden(true)
                Text(result.line).font(.heading)
            }
            .settles(result.cards.count + 2)
        }
    }

    @ViewBuilder private var footer: some View {
        switch phase {
        case .ask:
            HStack(spacing: Metrics.gap) {
                SecondaryButton(title: "Not today") { withAnimation(Motion.wave) { phase = .no } }
                PrimaryButton(title: "Yes") { withAnimation(Motion.wave) { phase = .what } }
            }
        case .no:
            PrimaryButton(title: "Got it") {
                if let onNotToday { onNotToday() } else { withAnimation(Motion.wave) { phase = .ask } }
            }
        case .what:
            PrimaryButton(title: "Log it", busy: busy, disabled: activity == nil) { Task { await logIt() } }
        case .logged:
            ErrorLine(text: error)
            PrimaryButton(title: "Done", action: onFinish)
            TextButton(title: "Undo this log") { Task { await undo() } }
        }
    }

    // ---------- actions ----------

    private func choose(_ a: String) {
        if a != activity {
            details.workout = nil
            details.amount = ""
        }
        activity = a
        guard !pickedByHand else { return }
        let fits = Catalog.activities.first { $0.key == a }?.fits ?? []
        let matching = open.filter { fits.contains($0.type) }
        picked = matching.count == 1 ? [matching[0].id] : []
    }

    /** What the workout measured fills in a challenge that counts the same thing, so it is typed once. */
    private func carryMetric() {
        guard let kind, let n = details.amountValue, n <= kind.max else { return }
        func nearest(_ type: String, _ v: Double) -> Double {
            let options = Catalog.logOptions(type)
            return options.min { abs($0 - v) < abs($1 - v) } ?? v
        }
        if kind.unit == "mi" { amounts["miles"] = nearest("miles", n) }
        if kind.unit == "min" {
            amounts["minutes"] = nearest("minutes", n)
            details.minutes = min(180, max(5, Int((n / 5).rounded()) * 5))
        }
    }

    private func logIt() async {
        guard let activity else { return }
        busy = true
        error = nil
        let entries: [[String: Any]] = chosen.map { c in
            var e: [String: Any] = ["challengeId": c.id]
            if let amount = measured(c.type) ?? amounts[c.type] { e["amount"] = amount }
            return e
        }
        do {
            var body: [String: Any] = ["activity": activity, "entries": entries]
            if !details.nothingToSend { body["details"] = details.payload }
            let res: CheckinResult = try await api.send("/checkin", body: body)
            result = res
            onLogged()
            withAnimation(Motion.wave) { phase = .logged }
            party += 1
        } catch {
            withAnimation(Motion.fluid) { self.error = error.localizedDescription }
        }
        busy = false
    }

    // Everyone taps the wrong thing sometimes. Right after logging, one tap takes it back.
    private func undo() async {
        guard let result else { return }
        do {
            let _: Empty = try await api.send("/checkin/undo", body: ["checkinId": result.checkinId])
            Haptic.warning()
            onFinish()
        } catch {
            withAnimation(Motion.fluid) { self.error = error.localizedDescription }
        }
    }
}

/** A card to swipe: right for yes, left for not today. It follows the finger and flies off on a spring. */
struct SwipeCard: View {
    var onDecide: (Bool) -> Void
    @State private var drag: CGSize = .zero
    @State private var gone: CGFloat = 0
    @State private var hinted = -1
    @State private var nudge: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        let x = drag.width + gone + nudge
        // How far toward a decision the card is: -1 is a firm "not today", 1 a firm "yes".
        let lean = max(-1, min(1, Double(x) / 130))
        VStack(spacing: 16) {
            Text(lean > 0.25 ? "💪" : lean < -0.25 ? "😴" : "🤔")
                .font(.system(size: 76))
                .scaleEffect(1 + abs(lean) * 0.35)
                .rotationEffect(.degrees(lean * -12))
                .contentTransition(.opacity)
                .accessibilityHidden(true)
            Text("👉 Swipe right for yes.\n👈 Swipe left for not today.")
                .font(.label)
                .foregroundStyle(Palette.stone)
                .multilineTextAlignment(.center)
                .opacity(1 - abs(lean))
        }
        .frame(maxWidth: .infinity, minHeight: 300)
        .background {
            RoundedRectangle(cornerRadius: 32).fill(Palette.card)
            // The card warms toward green for yes and cools to grey for not today.
            RoundedRectangle(cornerRadius: 32).fill(lean > 0 ? Palette.done : Palette.stone).opacity(abs(lean) * 0.22)
        }
        .overlay(alignment: .topLeading) { stamp("YES!", color: Palette.done, tilt: -14).opacity(max(0, lean * 1.4 - 0.2)).padding(22) }
        .overlay(alignment: .topTrailing) { stamp("NOT TODAY", color: Palette.stone, tilt: 12).opacity(max(0, -lean * 1.4 - 0.2)).padding(22) }
        .offset(x: x, y: abs(x) * 0.08)
        .rotationEffect(.degrees(Double(x) / 18), anchor: .bottom)
        .shadow(color: .black.opacity(0.08 + abs(lean) * 0.1), radius: 12 + abs(lean) * 10, y: 6)
        .animation(Motion.fluid, value: lean > 0.25)
        .animation(Motion.fluid, value: lean < -0.25)
        .gesture(
            DragGesture()
                .onChanged { g in
                    drag = g.translation
                    let side = g.translation.width > 100 ? 1 : g.translation.width < -100 ? 0 : -1
                    if side != hinted, side >= 0 { Haptic.tap(.rigid) }
                    hinted = side
                }
                .onEnded { g in
                    let fling = g.predictedEndTranslation.width
                    if abs(fling) > 160 {
                        let yes = fling > 0
                        Haptic.tap(.medium)
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.9)) {
                            gone = yes ? 600 : -600
                            drag = .zero
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { onDecide(yes) }
                    } else {
                        withAnimation(Motion.splash) { drag = .zero }
                    }
                }
        )
        .onAppear {
            // A little shimmy on arrival shows the card can be swiped.
            guard !reduce else { return }
            withAnimation(.spring(response: 0.35, dampingFraction: 0.45).delay(0.7)) { nudge = 26 }
            withAnimation(.spring(response: 0.4, dampingFraction: 0.5).delay(1.0)) { nudge = 0 }
        }
        .accessibilityElement()
        .accessibilityLabel("Did you work out today?")
        .accessibilityAction(named: "Yes") { onDecide(true) }
        .accessibilityAction(named: "Not today") { onDecide(false) }
    }

    private func stamp(_ text: String, color: Color, tilt: Double) -> some View {
        Text(text)
            .font(.system(.title2, design: .rounded).weight(.heavy))
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(color, lineWidth: 3))
            .rotationEffect(.degrees(tilt))
            .accessibilityHidden(true)
    }
}
