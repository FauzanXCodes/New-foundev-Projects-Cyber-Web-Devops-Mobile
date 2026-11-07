import SwiftUI

extension ChallengeContent where Footer == EmptyView {
    init(detail: ChallengeDetail, onChange: @escaping (ChallengeDetail) -> Void, eyebrow: String? = nil) {
        self.init(detail: detail, onChange: onChange, eyebrow: eyebrow, footer: { EmptyView() })
    }
}

struct InviteSpec {
    var type: String
    var target: Double
    var per: String
    var lengthDays: Int
    var name: String
    var consequence: String?
}

/** Four steps: what, how much, the consequence, and the invite. Created on the first send or skip. */
struct CreateView: View {
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0
    @State private var type: String?
    @State private var name = ""
    @State private var per = "week"
    @State private var target: Double = 3
    @State private var lengthDays = 28
    @State private var consequence = ""
    @State private var error: String?
    @State private var created: (id: String, token: String)?
    @State private var crew: [Person] = []
    @State private var crewPicked: [String] = []
    @State private var shared = true

    private let titles = ["What kind of challenge?", "How much and how long?", "Consequence for last place?", "Invite your crew."]
    private var kind: String { type ?? "custom" }
    private var spec: InviteSpec {
        InviteSpec(type: kind, target: target, per: per, lengthDays: lengthDays,
                   name: name.trimmed.isEmpty ? Catalog.info(kind).defaultName : name.trimmed,
                   consequence: consequence.trimmed.isEmpty ? nil : consequence.trimmed)
    }

    var body: some View {
        NavigationStack {
            Page(backdrop: false) {
                Text(titles[step]).font(.display).contentTransition(.opacity)
                Group {
                    switch step {
                    case 0:
                        ChipPicker(options: Catalog.challengeTypes.map { ChipOption(id: $0, label: Catalog.info($0).label, emoji: Catalog.emoji($0)) }, selection: type) { pick($0) }
                        RallyField(placeholder: "Or name your own", text: $name, maxLength: 40)
                    case 1:
                        WheelPicker(label: "Target", values: Catalog.targetOptions(kind, per: per), value: $target, format: Catalog.fmt)
                        ChipPicker(options: [ChipOption(id: "day", label: "Per day"), ChipOption(id: "week", label: "Per week")], selection: per) { changePer($0) }
                        ChipPicker(options: Catalog.lengths.map { ChipOption(id: "\($0.days)", label: $0.label) }, selection: "\(lengthDays)") { lengthDays = Int($0) ?? 28 }
                        Card {
                            EmojiBadge(emoji: Catalog.emoji(kind))
                            Text(Catalog.targetText(type: kind, target: target, per: per, lengthDays: lengthDays))
                                .font(.heading)
                                .contentTransition(.numericText())
                                .animation(Motion.fluid, value: target)
                        }
                    case 2:
                        ConsequencePicker(value: $consequence, context: "\(spec.name), \(Catalog.targetText(type: kind, target: target, per: per, lengthDays: lengthDays))", type: kind)
                        Text("Your crew votes on this once they're in. No money, nothing mean.").font(.footnote).foregroundStyle(Palette.stone)
                    default:
                        Toggle(isOn: $shared) {
                            VStack(alignment: .leading, spacing: 2) {
                                Label(shared ? "Friends of the crew can join" : "Invite only", systemImage: shared ? "person.2.badge.plus" : "lock.fill").font(.label)
                                Text(shared ? "Friends of anyone in it see it on their Home and can join." : "Only people you invite or add can get in.")
                                    .font(.footnote).foregroundStyle(Palette.stone)
                            }
                        }
                        .tint(Palette.signal)
                        .padding(Metrics.card - 4)
                        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
                        if !crew.isEmpty {
                            // People already in your crew go straight in: no link to send, nothing for them to tap.
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Add from your crew").font(.label)
                                MultiChipPicker(options: crew.map { ChipOption(id: $0.id, label: $0.name, emoji: crewPicked.contains($0.id) ? "✅" : "👤") }, selection: $crewPicked)
                            }
                            Text("Or invite someone new").font(.label).padding(.top, 4)
                        }
                        InviteComposer(spec: spec, getToken: { try await create().token }, onFinish: { dismiss() }, skipTitle: crewPicked.isEmpty ? "Start without inviting yet" : crewPicked.count == 1 ? "Add them and start" : "Add all \(crewPicked.count) and start", onSkip: {
                            Task {
                                do {
                                    _ = try await create()
                                    dismiss()
                                } catch {
                                    self.error = error.localizedDescription
                                }
                            }
                        })
                        ErrorLine(text: error)
                    }
                }
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .liquid), removal: .move(edge: .leading).combined(with: .liquid)))
                .id(step)
            } footer: {
                switch step {
                case 0: PrimaryButton(title: "Next", disabled: type == nil && name.trimmed.isEmpty) { go(1) }
                case 1: PrimaryButton(title: "Next") { go(2) }
                case 2:
                    PrimaryButton(title: "Next", disabled: Copy.consequenceProblem(consequence) != nil) { go(3) }
                    TextButton(title: "Skip for now") {
                        consequence = ""
                        go(3)
                    }
                default: EmptyView()
                }
            }
            .animation(Motion.wave, value: step)
            .task {
                if let home: HomeData = try? await api.send("/home") { crew = home.crew.map(\.person) }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if step > 0 { Button("Back", systemImage: "chevron.left") { go(step - 1) } }
                }
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        ForEach(0..<titles.count, id: \.self) { i in
                            Capsule().fill(i <= step ? Palette.ink : Palette.track)
                                .frame(width: i == step ? 22 : 10, height: 10)
                        }
                    }
                    .animation(Motion.splash, value: step)
                    .accessibilityElement()
                    .accessibilityLabel("Step \(step + 1) of \(titles.count)")
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Close", systemImage: "xmark") { dismiss() } }
            }
        }
    }

    private func go(_ s: Int) { withAnimation(Motion.wave) { step = s } }

    private func pick(_ t: String) {
        type = t
        per = Catalog.info(t).defaultPer
        target = Catalog.info(t).defaultTarget
    }

    private func changePer(_ next: String) {
        per = next
        let options = Catalog.targetOptions(kind, per: next)
        if !options.contains(target) {
            target = options.min { abs($0 - target) < abs($1 - target) } ?? options[0]
        }
    }

    // The challenge is created on the first send (or skip), so closing early leaves nothing behind.
    private func create() async throws -> (id: String, token: String) {
        if let created { return created }
        var body: [String: Any] = ["type": kind, "target": target, "per": per, "lengthDays": lengthDays, "shared": shared]
        if !name.trimmed.isEmpty { body["name"] = name.trimmed }
        if !consequence.trimmed.isEmpty { body["consequence"] = consequence.trimmed }
        struct Created: Decodable { var id: String; var token: String }
        let r: Created = try await api.send("/challenges", body: body)
        created = (r.id, r.token)
        if !crewPicked.isEmpty {
            // The challenge exists either way; if adding fails they can still be added from its page.
            let _: ChallengeDetail? = try? await api.send("/challenges/\(r.id)/add", body: ["userIds": crewPicked])
        }
        return (r.id, r.token)
    }
}

/**
 * Suggestion chips plus a line to write your own. With Apple Intelligence, "Suggest more" adds a few
 * fresh ideas written on the phone for this challenge.
 */
struct ConsequencePicker: View {
    @Binding var value: String
    var context: String
    /** The kind of challenge, so the suggestions can suit it. */
    var type: String = "custom"
    @State private var ideas: [String] = []
    @State private var thinking = false
    @State private var failed = false
    @State private var seen = Set(Copy.consequenceSuggestions.map { $0.lowercased() })

    private var suggested: Bool { Copy.suggestions(for: type).contains(value) }

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            ChipPicker(options: Copy.suggestions(for: type).map { ChipOption(id: $0, label: $0, emoji: Copy.consequenceEmoji($0)) }, selection: suggested ? value : nil) { v in
                value = v == value ? "" : v
            }
            if Intelligence.available {
                if !ideas.isEmpty {
                    ChipPicker(options: ideas.map { ChipOption(id: $0, label: $0, emoji: Copy.consequenceEmoji($0) == "🎯" ? "✨" : Copy.consequenceEmoji($0)) }, selection: ideas.contains(value) ? value : nil) { v in
                        value = v == value ? "" : v
                    }
                    .transition(.liquid)
                }
                SecondaryButton(title: ideas.isEmpty ? "Suggest more" : "More ideas", symbol: "apple.intelligence", busy: thinking, compact: true) {
                    Task { await ask() }
                }
                if failed { Text("No new ideas this time. Try again, or write your own.").font(.footnote).foregroundStyle(Palette.stone) }
            }
            RallyField(placeholder: "Or write your own", text: Binding(get: { suggested ? "" : value }, set: { value = $0 }), maxLength: 80)
            ErrorLine(text: Copy.consequenceProblem(value))
        }
        .animation(Motion.fluid, value: ideas)
        .animation(Motion.fluid, value: value)
    }

    private func ask() async {
        thinking = true
        failed = false
        let fresh = await Intelligence.consequenceIdeas(for: context).filter { !seen.contains($0.lowercased()) }
        fresh.forEach { seen.insert($0.lowercased()) }
        if fresh.isEmpty { failed = Intelligence.available } else { ideas = fresh }
        thinking = false
    }
}

/** The message picker and its send buttons. */
struct InviteComposer: View {
    var spec: InviteSpec
    var getToken: () async throws -> String
    var onFinish: () -> Void
    var skipTitle = "Start without inviting yet"
    var onSkip: (() -> Void)? = nil
    @Environment(API.self) private var api
    @State private var tone = "friendly"
    @State private var busy: String?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            Picker("Tone", selection: $tone) {
                ForEach(Copy.tones, id: \.key) { Text("\(Copy.toneEmoji[$0.key] ?? "") \($0.label)").tag($0.key) }
            }
            .pickerStyle(.segmented)
            Card {
                // The real link is only made when someone actually sends, so the preview shows a placeholder.
                Text(Copy.inviteMessage(tone: tone, type: spec.type, target: spec.target, per: spec.per, lengthDays: spec.lengthDays, name: spec.name, consequence: spec.consequence, link: "[link]"))
                    .contentTransition(.interpolate)
                    .animation(Motion.fluid, value: tone)
            }
            ErrorLine(text: error)
            PrimaryButton(title: "Send by text", symbol: "message.fill", busy: busy == "text", disabled: busy != nil) { send("text") }
            SecondaryButton(title: "Pick from contacts", symbol: "person.crop.circle", busy: busy == "contacts", disabled: busy != nil) { send("contacts") }
            TextButton(title: "Share another way") { if busy == nil { send("share") } }
            if let onSkip { TextButton(title: skipTitle, action: onSkip) }
        }
    }

    private func send(_ how: String) {
        Task {
            busy = how
            error = nil
            do {
                let token = try await getToken()
                // The code rides along with the link: it is what works when the link will not tap.
                let message = "\(Copy.inviteMessage(tone: tone, type: spec.type, target: spec.target, per: spec.per, lengthDays: spec.lengthDays, name: spec.name, consequence: spec.consequence, link: api.inviteLink(token)))\n\nOr open Rally and enter the code \(Copy.formatInviteCode(token))."
                let outcome: Sent = switch how {
                case "text": await Share.text(message)
                case "contacts": await Share.textContact(message)
                default: await Share.sheet(message)
                }
                if outcome == .sent {
                    Toaster.shared.confirm("📨", "Invite sent")
                    onFinish()
                }
            } catch {
                self.error = error.localizedDescription
            }
            busy = nil
        }
    }
}

struct JoinView: View {
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var remote = Remote<[HouseCard]>("/house")
    @State private var busy: String?
    @State private var error: String?
    @State private var inviteOpen = false

    var body: some View {
        Page {
            Text("Join a challenge").font(.display).settles(0)
            Card {
                Text("💌 Have an invite?").font(.heading).accessibilityLabel("Have an invite?")
                Text("Paste the link or type the code a friend sent you.").foregroundStyle(Palette.stone)
                HStack { Spacer(); SecondaryButton(title: "Enter it", compact: true) { inviteOpen = true } }
            }
            .settles(1)
            ErrorLine(text: error)
            if let houses = remote.data {
                ForEach(Array(houses.enumerated()), id: \.element.id) { i, h in
                    Card {
                        HStack(spacing: Metrics.gap) {
                            EmojiBadge(emoji: Catalog.emoji(h.kind))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(h.name).font(.heading)
                                Text(h.targetText).foregroundStyle(Palette.stone)
                            }
                        }
                        HStack {
                            Text(h.joined ? "You're in" : h.memberCount == 0 ? "Be the first one in" : h.memberCount == 1 ? "1 person in" : "\(h.memberCount) people in").font(.label)
                            Spacer()
                            SecondaryButton(title: h.joined ? "Open" : "Join", busy: busy == h.id, compact: true) { Task { await join(h) } }
                        }
                        .padding(.top, Metrics.gap)
                    }
                    .settles(i + 2)
                }
            } else {
                Waiting(error: remote.error, heights: [110, 110, 110]) { Task { await remote.load() } }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .loads(remote)
        .sheet(isPresented: $inviteOpen) { InviteCodeSheet() }
    }

    private func join(_ h: HouseCard) async {
        busy = h.id
        error = nil
        do {
            if !h.joined { let _: ChallengeDetail = try await api.send("/challenges/\(h.id)/join", body: [:]) }
            router.home = [.challenge(h.id)]
        } catch {
            self.error = error.localizedDescription
        }
        busy = nil
    }
}

/** For a friend who has the app but never tapped a link. Paste the whole text or just the code. */
struct InviteCodeSheet: View {
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            Text("💌 Have an invite?").font(.heading).accessibilityLabel("Have an invite?")
            Text("Paste the link your friend sent, or type the code from their text.")
            TextField("Link or code", text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 16)
                .frame(minHeight: 54)
                .background(Palette.card, in: .rect(cornerRadius: 16))
                .onSubmit(go)
                .onChange(of: text) { error = nil }
            ErrorLine(text: error)
            PrimaryButton(title: "Continue", disabled: text.trimmed.isEmpty, action: go)
        }
        .padding(Metrics.screen)
        .presentationDetents([.height(330)])
        .animation(Motion.fluid, value: error)
    }

    private func go() {
        guard let token = Copy.parseInviteInput(text) else {
            error = "That doesn't look like an invite. Paste the link or type the code from the text."
            Haptic.warning()
            return
        }
        dismiss()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { router.invite = InviteLink(token: token) }
    }
}

/** Where an invite link lands. You see the challenge and its consequence before making an account. */
struct InviteView: View {
    var token: String
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var preview: InvitePreview?
    @State private var loadError: String?
    @State private var details = false
    @State private var name = ""
    @State private var band = "active"
    @State private var time = "07:00"
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if let preview {
                    if details { detailsForm(preview) } else { look(preview) }
                } else {
                    Page {
                        if let loadError { Card { Text(loadError) } } else { Skeleton(heights: [40, 110, 160]) }
                    }
                }
            }
            .animation(Motion.wave, value: details)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if details { Button("Back", systemImage: "chevron.left") { details = false } }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Close", systemImage: "xmark") { dismiss() } }
            }
        }
        .task(id: api.token) {
            do {
                let p: InvitePreview = try await api.send("/invites/\(token)")
                if p.alreadyMember, let c = p.challenge {
                    dismiss()
                    router.show(challenge: c.id)
                } else {
                    withAnimation(Motion.wave) { preview = p }
                }
            } catch {
                loadError = error.localizedDescription
            }
        }
    }

    @ViewBuilder private func look(_ p: InvitePreview) -> some View {
        if let c = p.challenge {
            ChallengeContent(detail: c, onChange: { _ in }, eyebrow: "\(p.inviterName) invited you") { inviteFooter(p) }
        } else {
            Page {
                SymbolArt(symbol: "person.2.fill", size: 96).settles(0)
                Text("\(p.inviterName) wants you in their crew.").font(.display).settles(0)
                Text("Start challenges together and keep each other honest.").foregroundStyle(Palette.stone).settles(1)
            } footer: { inviteFooter(p) }
        }
    }

    @ViewBuilder private func inviteFooter(_ p: InvitePreview) -> some View {
        ErrorLine(text: error)
        if p.ended {
            Text("This challenge has ended.").foregroundStyle(Palette.stone)
        } else {
            PrimaryButton(title: "I'm in", symbol: "hand.raised.fill", busy: busy) { Task { await imIn() } }
            if !api.signedIn {
                TextButton(title: "Already have an account? Sign in") {
                    dismiss()
                    router.auth = [.signin(invite: token)]
                }
            }
        }
    }

    private func detailsForm(_ p: InvitePreview) -> some View {
        Page {
            Text("What should we call you?").font(.display)
            RallyField(placeholder: "Your name", text: $name, capitalization: .words, maxLength: 30)
            if let c = p.challenge, Catalog.fairPlay(c.type, house: c.house) {
                Text("How active are you?").font(.heading).padding(.top, Metrics.gap)
                ChipPicker(options: Catalog.bands.map { ChipOption(id: $0.key, label: $0.label, emoji: Catalog.bandEmoji[$0.key]) }, selection: band) { band = $0 }
                Text("Sets your own target, so this stays a fair fight.").foregroundStyle(Palette.stone)
            }
            Text("When do you usually work out?").font(.heading).padding(.top, Metrics.gap)
            WheelPicker(label: "Workout time", values: Catalog.times, value: $time, format: Catalog.timeLabel)
            Text("We'll remind you once a day.").foregroundStyle(Palette.stone)
        } footer: {
            ErrorLine(text: error)
            PrimaryButton(title: p.challenge != nil ? "Join the challenge" : "Join the crew", busy: busy, disabled: name.trimmed.isEmpty) {
                Task { await createAccount(p) }
            }
        }
        .transition(.liquid)
    }

    private func imIn() async {
        guard api.signedIn else {
            withAnimation(Motion.wave) { details = true }
            return
        }
        busy = true
        do {
            let r: ChallengeIdResponse = try await api.send("/invites/\(token)/accept", body: [:])
            Haptic.success()
            dismiss()
            if let id = r.challengeId { router.show(challenge: id) }
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }

    private func createAccount(_ p: InvitePreview) async {
        busy = true
        do {
            let res: SignupResult = try await api.send("/signup", body: ["name": name.trimmed, "workoutTime": time, "band": band, "inviteToken": token])
            api.rememberAccount(LockedAccount(token: res.token, name: res.user.name, avatar: res.user.avatar))
            api.setSession(res.token)
            Haptic.success()
            dismiss()
            if let id = res.challengeId { router.show(challenge: id) }
            await Reminders.schedule(enabled: true, time: time, friend: p.inviterName, ask: true)
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}
