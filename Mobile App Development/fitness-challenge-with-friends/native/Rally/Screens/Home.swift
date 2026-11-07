import SwiftUI

struct HomeView: View {
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var remote = Remote<HomeData>("/home")
    @State private var friend: Person?
    @State private var adding = false
    @State private var deleting: ChallengeCard?
    @State private var deleteError: String?

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: .now)
        return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"
    }

    private var greetingEmoji: String {
        let h = Calendar.current.component(.hour, from: .now)
        return h < 12 ? "☀️" : h < 17 ? "👋" : "🌙"
    }

    var body: some View {
        Page {
            if let data = remote.data {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(greeting), \(data.user.name).")
                    WavingHand(emoji: greetingEmoji)
                }
                .font(.display)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(greeting), \(data.user.name).")
                .settles(0)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Metrics.gap) {
                        ForEach(data.crew) { f in
                            Button { friend = f.person } label: {
                                VStack(spacing: 4) {
                                    AvatarView(person: f.person, size: 56, dot: f.loggedToday)
                                    Text(f.name).font(.footnote).foregroundStyle(Palette.ink).lineLimit(1)
                                }
                                .frame(width: 64)
                            }
                            .buttonStyle(WaterButtonStyle())
                            .accessibilityLabel(f.loggedToday ? "\(f.name), logged today" : f.name)
                        }
                        Button { adding = true } label: {
                            VStack(spacing: 4) {
                                Circle()
                                    .strokeBorder(Palette.ink, style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                                    .frame(width: 56, height: 56)
                                    .overlay(Image(systemName: "plus").font(.title3.weight(.semibold)))
                                Text("Add").font(.footnote)
                            }
                            .foregroundStyle(Palette.ink)
                            .frame(width: 64)
                        }
                        .buttonStyle(WaterButtonStyle())
                        .accessibilityLabel("Add to your crew")
                    }
                    .padding(.horizontal, Metrics.screen)
                }
                .padding(.horizontal, -Metrics.screen)
                .flowsIn(1)

                if DebugDemo.flag("RallyJoinFirst") { JoinSection(suggested: data.suggested ?? []) }

                HStack(alignment: .top, spacing: Metrics.gap) {
                    Text("💪").font(.title2).bobbing().accessibilityHidden(true)
                    Text(Copy.banner())
                    Spacer(minLength: 0)
                }
                .padding(Metrics.card)
                .background { AliveGradient() }
                .clipShape(.rect(cornerRadius: Metrics.radius))
                .settles(2)

                VStack(alignment: .leading, spacing: Metrics.gap) {
                    Text("Your challenges").font(.heading).settles(3)
                    if data.challenges.isEmpty {
                        EmptyNote(symbol: "figure.run", text: "No challenges yet. Start one, or join one below.").settles(4)
                    }
                    ForEach(Array(data.challenges.enumerated()), id: \.element.id) { i, c in
                        Button { router.home.append(.challenge(c.id)) } label: { ChallengeCardView(card: c, deletable: c.mine == true) }
                            .buttonStyle(WaterButtonStyle())
                            // The bin sits over the card rather than inside its label, so tapping it never opens the challenge.
                            .overlay(alignment: .bottomTrailing) {
                                if c.mine == true {
                                    Button { deleting = c } label: {
                                        Image(systemName: "trash")
                                            .font(.subheadline)
                                            .foregroundStyle(Palette.stone)
                                            .frame(width: 44, height: 44)
                                            .contentShape(.rect)
                                    }
                                    .accessibilityLabel("Delete \(c.name)")
                                    .padding(.trailing, 6)
                                    .padding(.bottom, 4)
                                }
                            }
                            .scrollLively()
                            .settles(4 + i)
                            .transition(.liquid)
                    }
                }

                JoinSection(suggested: data.suggested ?? []).settles(5 + data.challenges.count)

            } else {
                Waiting(error: remote.error, heights: [34, 56, 110, 110]) { Task { await remote.load() } }
            }
        }
        // Debug only: -RallyScrolled YES opens Home at its bottom, to check the scrolled state.
        .defaultScrollAnchor(DebugDemo.flag("RallyScrolled") ? .bottom : .top)
        // Past the top of the page, Start a challenge moves into the tab bar (see MainTabs).
        .onScrollGeometryChange(for: Bool.self) { g in
            g.contentOffset.y + g.contentInsets.top > 80
        } action: { _, scrolled in
            withAnimation(Motion.splash) { router.homeScrolled = scrolled }
        }
        .loads(remote)
        .task(id: remote.data?.user.workoutTime) {
            guard let d = remote.data else { return }
            // Debug only: -RallyOpenFirst YES goes straight into the first challenge.
            if DebugDemo.flag("RallyOpenFirst"), router.home.isEmpty, let first = d.challenges.first { router.show(challenge: first.id) }
            await Reminders.schedule(enabled: d.user.notifications, time: d.user.workoutTime, friend: d.crew.first?.name)
            await StepSync.shared.sync()
            Nudges.addedToChallenges(d, router: router)
            Nudges.crewJoined(d, router: router)
            await Nudges.afterHomeLoads(d, router: router)
        }
        .sheet(item: $friend) { FriendSheet(friend: $0) }
        .sheet(isPresented: $adding) { AddCrewSheet() }
        .confirmationDialog(deleting?.name ?? "", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", systemImage: "trash", role: .destructive) {
                guard let c = deleting else { return }
                Task {
                    do {
                        let _: Empty = try await api.send("/challenges/\(c.id)/delete", body: [:])
                        Toaster.shared.confirm("🗑️", "\(c.name) deleted")
                        withAnimation(Motion.wave) { remote.data?.challenges.removeAll { $0.id == c.id } }
                    } catch {
                        deleteError = error.localizedDescription
                    }
                }
            }
        }
        .alert("Couldn't delete", isPresented: Binding(get: { deleteError != nil }, set: { if !$0 { deleteError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deleteError ?? "")
        }
    }
}

/**
 * Join a challenge, as part of Home: open challenges anyone can join, the ones that match what this
 * person tracks first, and a way in for someone holding an invite.
 */
struct JoinSection: View {
    /** Challenges someone in your crew is already in. Nothing is offered until a friend is in something. */
    var suggested: [Suggestion]
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var busy: String?
    @State private var error: String?
    @State private var inviteOpen = false

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            if !suggested.isEmpty {
                Text("Your crew is in").font(.heading)
                ErrorLine(text: error)
                ForEach(suggested) { s in
                    HStack(spacing: Metrics.gap) {
                        EmojiBadge(emoji: Catalog.emoji(s.type))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(s.name).font(.headline)
                            Text(s.targetText).font(.subheadline).foregroundStyle(Palette.stone)
                            HStack(spacing: 6) {
                                AvatarStack(people: Array(s.friends.prefix(3)), total: s.friends.count, size: 22)
                                Text(s.whoText).font(.footnote.weight(.medium))
                            }
                        }
                        Spacer(minLength: 0)
                        SecondaryButton(title: "Join", busy: busy == s.id, compact: true) { Task { await join(s) } }
                    }
                    .padding(Metrics.card - 4)
                    .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
                    .scrollLively()
                }
            }
            Button { inviteOpen = true } label: {
                HStack(spacing: Metrics.gap) {
                    EmojiBadge(emoji: "💌", tint: Palette.card)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Have an invite?").font(.headline)
                        Text("Paste the link or type the code a friend sent.").font(.subheadline).foregroundStyle(Palette.stone)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.faint)
                }
                .multilineTextAlignment(.leading)
                .foregroundStyle(Palette.ink)
                .padding(Metrics.card - 4)
                .background(Palette.signalTint, in: .rect(cornerRadius: Metrics.radius))
            }
            .buttonStyle(WaterButtonStyle())
            // The open challenges are still there for anyone who goes looking; they are just not pushed.
            TextButton(title: "Browse open challenges") { router.home.append(.join) }
        }
        .sheet(isPresented: $inviteOpen) { InviteCodeSheet() }
    }

    private func join(_ s: Suggestion) async {
        busy = s.id
        error = nil
        do {
            let _: ChallengeDetail = try await api.send("/challenges/\(s.id)/join", body: [:])
            Toaster.shared.show(Toast(emoji: "🙌", title: "You're in \(s.name)", detail: "Log your first one whenever you're ready."))
            router.home.append(.challenge(s.id))
        } catch {
            self.error = error.localizedDescription
        }
        busy = nil
    }
}

/** The card for one challenge, on Home and on the "Logged" screen. */
struct ChallengeCardView: View {
    var card: ChallengeCard
    /** The fraction before the log that just happened, so the gauge fills up from there. */
    var from: Double? = nil
    /** Leaves room in the bottom corner for Home's delete button. */
    var deletable = false
    @State private var splash = false
    @State private var shown: Double?
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: Metrics.gap) {
                EmojiBadge(emoji: Catalog.emoji(card.kind)).popIn(delay: 0.25)
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.name).font(.headline).lineLimit(2).multilineTextAlignment(.leading)
                    // What the challenge is. Two with the same name are told apart by this line.
                    Text(card.targetShort).font(.subheadline).foregroundStyle(Palette.stone)
                    Text(card.progressText).font(.footnote.weight(.medium)).contentTransition(.numericText())
                }
                Spacer(minLength: 0)
                // SwiftUI's own circular gauge: the same control the system uses for rings like battery level.
                Gauge(value: min(1, max(0, shown ?? card.fraction))) {
                    EmptyView()
                } currentValueLabel: {
                    if card.periodDone {
                        Image(systemName: "checkmark").fontWeight(.bold).foregroundStyle(Palette.done)
                    } else {
                        Text("\(Int((card.fraction * 100).rounded()))%").foregroundStyle(Palette.ink).minimumScaleFactor(0.6)
                    }
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(card.periodDone ? Palette.done : Palette.signal)
                .scaleEffect(0.82)
                .frame(width: 50, height: 50)
            }
            HStack {
                AvatarStack(people: card.members, total: card.memberCount, size: 24)
                Spacer()
                Label(card.waiting ? "Waiting for your crew" : card.daysLeftText, systemImage: card.waiting ? "hourglass" : "calendar")
                    .font(.footnote).foregroundStyle(Palette.stone)
                if deletable { Color.clear.frame(width: 26, height: 1) }
            }
        }
        .padding(Metrics.card - 2)
        .foregroundStyle(Palette.ink)
        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        .overlay { if splash { Splash() } }
        .onAppear {
            if card.complete, Splash.claim(card.id) { splash = true }
            // The ring always sweeps up to its level: from the last value after a log, from empty otherwise.
            if !reduce {
                shown = from ?? 0
                withAnimation(Motion.wave.delay(0.35)) { shown = card.fraction }
            }
        }
        .onChange(of: card.fraction) { _, f in withAnimation(reduce ? nil : Motion.wave) { shown = f } }
        .onChange(of: card.complete) { _, done in if done, Splash.claim(card.id) { splash = true } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(card.name). \(card.progressText). \(card.waiting ? "Waiting for your crew" : card.daysLeftText).")
    }
}

/** Drops of water thrown up when a challenge is complete. Shown once per challenge. */
struct Splash: View {
    @State private var t = 0.0

    /** True the first time it is asked about a challenge on this phone, false after that. */
    static func claim(_ id: String) -> Bool {
        let key = "splashed:\(id)"
        guard !UserDefaults.standard.bool(forKey: key) else { return false }
        UserDefaults.standard.set(true, forKey: key)
        return true
    }

    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        GeometryReader { g in
            ForEach(0..<18, id: \.self) { i in
                let angle = Double(i) / 18 * 2 * .pi
                let reach = 60 + Double(i % 4) * 22
                Circle()
                    .fill(i % 3 == 0 ? Palette.accent : Palette.water.opacity(0.8))
                    .frame(width: 6 + CGFloat(i % 3) * 2)
                    .position(x: g.size.width / 2 + cos(angle) * reach * t,
                              y: g.size.height / 2 + sin(angle) * reach * t + 120 * t * t)
                    .opacity(1 - t)
            }
        }
        .allowsHitTesting(false)
        .onAppear {
            guard !reduce else { return }
            withAnimation(.easeOut(duration: 1.3)) { t = 1 }
        }
    }
}

struct FriendSheet: View {
    var friend: Person
    @Environment(API.self) private var api
    @State private var info: FriendData?

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap * 1.5) {
            HStack(spacing: Metrics.gap) {
                AvatarView(person: friend, size: 56)
                Text(friend.name).font(.heading)
            }
            row("✅  Challenges completed", info.map { "\($0.completed)" })
            row("🏆  Biggest win", info.map { $0.biggestWin ?? "No wins yet" })
            if let recent = info?.recent, !recent.isEmpty {
                Text("Shared workouts").font(.label).foregroundStyle(Palette.stone)
                ScrollView {
                    VStack(spacing: Metrics.gap) {
                        ForEach(recent) { WorkoutRow(workout: $0, showsPrivacy: false) }
                    }
                }
            }
        }
        .padding(Metrics.screen)
        .presentationDetents(info?.recent?.isEmpty == false ? [.medium, .large] : [.height(240)])
        .task { info = try? await api.send("/crew/\(friend.id)") }
    }

    private func row(_ label: String, _ value: String?) -> some View {
        HStack {
            Text(label).foregroundStyle(Palette.stone)
            Spacer()
            Text(value ?? " ").font(.label).multilineTextAlignment(.trailing).contentTransition(.opacity)
        }
        .animation(Motion.fluid, value: value)
    }
}

struct AddCrewSheet: View {
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?

    var body: some View {
        VStack(spacing: Metrics.gap) {
            HStack(spacing: Metrics.gap) {
                SymbolArt(symbol: "person.2.fill", size: 52)
                Text("Add to your crew").font(.heading)
                Spacer()
            }
            PrimaryButton(title: "Text a link", symbol: "message.fill") { send(.text) }
            SecondaryButton(title: "Find from contacts", symbol: "person.crop.circle") { send(.contacts) }
            TextButton(title: "Share another way") { send(.share) }
            ErrorLine(text: error)
        }
        .padding(Metrics.screen)
        .presentationDetents([.height(330)])
    }

    private enum How { case text, contacts, share }

    private func send(_ how: How) {
        Task {
            error = nil
            do {
                let r: TokenResponse = try await api.send("/crew/invite", body: [:])
                let message = "\(Copy.crewInviteMessage(api.inviteLink(r.token)))\n\nOr open Rally and enter the code \(Copy.formatInviteCode(r.token))."
                let outcome: Sent = switch how {
                case .text: await Share.text(message)
                case .contacts: await Share.textContact(message)
                case .share: await Share.sheet(message)
                }
                if outcome == .sent {
                    Toaster.shared.confirm("📨", "Invite sent")
                    dismiss()
                }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
