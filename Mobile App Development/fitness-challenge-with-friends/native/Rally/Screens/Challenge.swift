import SwiftUI
import Charts

struct ChallengeScreen: View {
    var id: String
    @State private var remote: Remote<ChallengeDetail>

    init(id: String) {
        self.id = id
        _remote = State(initialValue: Remote<ChallengeDetail>("/challenges/\(id)"))
    }

    var body: some View {
        Group {
            if let detail = remote.data {
                ChallengeContent(detail: detail, onChange: { new in withAnimation(Motion.wave) { remote.data = new } })
            } else {
                Page { Waiting(error: remote.error, heights: [40, 76, 110, 160]) { Task { await remote.load() } } }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .loads(remote)
    }
}

/** The one place a challenge lives. Read only (an invite preview) hides logging, inviting and managing. */
struct ChallengeContent<Footer: View>: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    var eyebrow: String? = nil
    @ViewBuilder var footer: Footer

    private enum SheetKind: String, Identifiable { case propose, invite, manage; var id: String { rawValue } }

    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var sheet: SheetKind?
    @State private var busy: String?
    @State private var error: String?
    @State private var recap: String?
    @State private var party = 0
    @Environment(\.dynamicTypeSize) private var dynamicType

    private var live: Bool { !detail.you.readOnly }

    private var statusTag: String {
        switch detail.status {
        case "waiting": "⏳ Waiting for crew"
        case "done": "🏁 Finished"
        default: "🔥 Live"
        }
    }

    var body: some View {
        Page {
            PhotoBanner(name: detail.type, emoji: Catalog.emoji(detail.type), height: 170, fadeTo: Palette.page)
                .clipShape(.rect(cornerRadius: Metrics.radius))
                .overlay(alignment: .topLeading) {
                    Text(statusTag)
                        .font(.footnote.weight(.semibold))
                        // Set outright: text left to take its color from the glass disappears inside the
                        // settle effect's layer, leaving only the emoji.
                        .foregroundStyle(Palette.ink)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .glassEffect(.regular, in: .capsule)
                        .padding(12)
                }
                .overlay(alignment: .bottomLeading) {
                    EmojiBadge(emoji: Catalog.emoji(detail.type), size: 60, tint: Palette.card)
                        .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
                        .bobbing()
                        .padding(.leading, 14)
                        .offset(y: 18)
                }
                .padding(.bottom, 10)
                .settles(0)

            VStack(alignment: .leading, spacing: 4) {
                if let eyebrow { Text("👋 \(eyebrow)").font(.label).foregroundStyle(Palette.stone) }
                Text(detail.name).font(.display)
                Text(detail.targetText).foregroundStyle(Palette.stone)
                if let goal = detail.yourGoalText { Text("Your goal: \(goal)").font(.footnote).foregroundStyle(Palette.stone) }
            }
            .settles(0)

            // 1. Where you are, and how long is left.
            if let me = detail.standings.first(where: \.isYou), detail.status != "done" {
                YourProgressCard(row: me, waiting: detail.status == "waiting", daysLeft: detail.daysLeftText, range: detail.rangeText, timeFraction: detail.timeFraction)
                    .settles(1)
            } else {
                HStack {
                    Text("🗓️ \(detail.daysLeftText)").font(.label).accessibilityLabel(detail.daysLeftText)
                    Spacer()
                    Text(detail.rangeText).font(.footnote).foregroundStyle(Palette.stone)
                }
                .settles(1)
            }

            if detail.type == "steps", live {
                StepsNote().settles(1)
            }

            if let timeline = detail.timeline, timeline.days.contains(where: { !$0.future }) {
                TimelineCard(timeline: timeline).flowsIn(1)
            }

            if let result = detail.resultText {
                Card {
                    if detail.winnerName != nil {
                        // The confetti waits for the trophy, so the two land together and nothing stalls mid-burst.
                        Trophy3D(height: 170, onReady: {
                            if detail.you.result == "won", Splash.claim("won:\(detail.id)") { party += 1 }
                        })
                        .frame(maxWidth: .infinity)
                    }
                    HStack(spacing: Metrics.gap) {
                        Image(systemName: detail.winnerName != nil ? "trophy.fill" : "flag.checkered")
                            .font(.title2)
                            .foregroundStyle(Palette.accent)
                        Text(result).font(.label)
                    }
                }
                .flowsIn(1)
            }

            if let recap {
                Card {
                    HStack(alignment: .top, spacing: Metrics.gap) {
                        Image(systemName: "apple.intelligence")
                            .font(.title3)
                            .foregroundStyle(LinearGradient(colors: [.orange, .pink, .purple, .blue], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .symbolEffect(.breathe, options: .nonRepeating)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(recap)
                            Text("Written on this iPhone by Apple Intelligence").font(.footnote).foregroundStyle(Palette.stone)
                        }
                    }
                }
                .transition(.liquid)
            }

            ForEach(detail.alerts, id: \.self) { alert in
                Card {
                    Label(alert, systemImage: "bell.badge.fill").symbolRenderingMode(.multicolor)
                }
            }

            // 2. Everyone else.
            VStack(alignment: .leading, spacing: Metrics.gap) {
                HStack(alignment: .firstTextBaseline) {
                    Text("🏅 Standings").font(.heading).accessibilityLabel("Standings")
                    Spacer()
                    if detail.standings.count >= 2, detail.status == "live", let leader = detail.standings.first, leader.percent > 0 {
                        Text(leader.isYou ? "👑 You lead" : "👑 \(leader.name) leads").font(.label).foregroundStyle(Palette.stone)
                    }
                }
                VStack(spacing: 4) {
                    ForEach(Array(detail.standings.enumerated()), id: \.element.id) { i, row in
                        StandingRow(row: row, medals: detail.standings.count >= 2).settles(i + 1)
                    }
                    Divider().padding(.horizontal, 8).padding(.vertical, 4)
                    HStack {
                        AvatarStack(people: Array(detail.members.prefix(6)), total: detail.members.count, size: 30)
                        Spacer()
                        if live {
                            SecondaryButton(title: detail.members.count < 2 ? "Invite your crew" : "Invite more", symbol: "person.badge.plus", compact: true) { sheet = .invite }
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.bottom, 4)
                }
                .padding(8)
                .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
            }
            .padding(.top, Metrics.gap)
            .settles(2)

            if detail.you.member, detail.status != "done", let talk = detail.talk {
                TalkCard(detail: detail, lines: talk, onChange: onChange).padding(.top, Metrics.gap).flowsIn(2)
            }

            // 3. What it is all for.
            VStack(alignment: .leading, spacing: Metrics.gap) {
                Text("⚔️ What's at stake").font(.heading).accessibilityLabel("What's at stake")
                if MedalView.kind(detail.you.medal) != nil {
                    RewardCard(detail: detail)
                }
                if let stakes = detail.stakes {
                    StakesCard(stakes: stakes, medal: detail.you.member && detail.you.medal == nil && detail.status != "done")
                }
                consequenceCard
                if detail.rename != nil {
                    RenameCard(detail: detail, onChange: onChange)
                }
            }
            .padding(.top, Metrics.gap)
            .settles(3)

            if sheet == nil { ErrorLine(text: error) }
            if detail.you.commissioner {
                TextButton(title: "Manage challenge") { sheet = .manage }
            }
        } footer: {
            if Footer.self == EmptyView.self {
                if live {
                    if detail.you.loggedToday == true {
                        // A session challenge takes one log a day, so once it is in the button says so.
                        Label("Logged today", systemImage: "checkmark.circle.fill")
                            .font(.headline)
                            .foregroundStyle(Palette.done)
                            .frame(maxWidth: .infinity, minHeight: 54)
                            .background(Palette.card, in: .capsule)
                            .overlay(Capsule().strokeBorder(Palette.done.opacity(0.5), lineWidth: 1))
                            .transition(.liquid)
                    } else {
                        PrimaryButton(title: "Log workout", symbol: "plus.circle.fill") { router.logging = detail.id }
                    }
                }
            } else {
                footer
            }
        }
        // A win is worth a party: once per challenge on this phone, the first time its result is seen.
        .overlay { ConfettiBurst(trigger: party, emoji: ["🏆", "🎉", "👑"]) }
        .animation(Motion.wave, value: recap)
        .task(id: detail) { recap = await Intelligence.recap(detail) }
        .sheet(item: $sheet) { kind in
            switch kind {
            case .propose: ProposeSheet(detail: detail, onChange: onChange)
            case .invite: InviteSheet(detail: detail, onChange: onChange)
            case .manage: ManageSheet(detail: detail, onChange: onChange)
            }
        }
    }

    @ViewBuilder private var consequenceCard: some View {
        Card(tint: true) {
            Text("🎯 Consequence").font(.label).foregroundStyle(Palette.stone).accessibilityLabel("Consequence")
            if let c = detail.consequence {
                if c.status == "none" {
                    Text("🤝 Nothing agreed yet")
                    if live { SecondaryButton(title: "Propose one", compact: true) { sheet = .propose } }
                } else {
                    HStack(spacing: Metrics.gap) {
                        EmojiBadge(emoji: Copy.consequenceEmoji(c.text ?? ""), size: 40, tint: Palette.card)
                        Text(c.text ?? "")
                    }
                    if c.status == "agreed" {
                        Label("Agreed", systemImage: "checkmark.seal.fill").font(.label).foregroundStyle(Palette.accent)
                            .symbolEffect(.bounce, value: c.status)
                    } else {
                        Text(c.youProposed ? "Proposed by you" : "Proposed by \(c.proposedBy ?? "someone")").font(.footnote)
                        if live && c.youAgreed {
                            Text(c.waitingOn > 0 ? "Waiting on \(c.waitingOn) more to agree" : "Your crew votes once they join").font(.footnote)
                        }
                        if live {
                            HStack {
                                if !c.youAgreed {
                                    SecondaryButton(title: "Agree", symbol: "hand.thumbsup.fill", busy: busy == "agree", compact: true) {
                                        Task { await act("agree", "/consequence/agree") }
                                    }
                                }
                                SecondaryButton(title: "Suggest another", compact: true) { sheet = .propose }
                            }
                        }
                    }
                }
            } else {
                Text(detail.house ? "Nothing on this one. The badges are the stakes." : "😎 No real-life consequence on this one.")
            }
        }
    }

    private func act(_ key: String, _ path: String, _ body: [String: Any] = [:]) async {
        busy = key
        error = nil
        do {
            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)\(path)", body: body)
            if key == "agree" { Toaster.shared.confirm("🤝", next.consequence?.status == "agreed" ? "It's agreed" : "You're in on it") } else { Haptic.success() }
            onChange(next)
        } catch {
            withAnimation(Motion.fluid) { self.error = error.localizedDescription }
        }
        busy = nil
    }
}

/** Where you stand, as a ring that fills, with a line that fits how far along you are. */
private struct YourProgressCard: View {
    var row: Standing
    var waiting: Bool
    var daysLeft: String
    var range: String
    var timeFraction: Double
    @State private var shown = 0.0
    @Environment(\.accessibilityReduceMotion) private var reduce

    private var cheer: String {
        if row.onTheHook { return "You're on the hook 🪝 Time to move." }
        switch row.percent {
        case 100...: return "Done! Nothing left but bragging 🎉"
        case 50..<100: return "Over halfway. Don't let up 🔥"
        case 1..<50: return "Good start. Keep it moving 💪"
        default: return waiting ? "Get a head start while your crew joins 👟" : "Log your first one today 👟"
        }
    }

    var body: some View {
        Card {
            HStack(spacing: Metrics.card) {
                ZStack {
                    Circle().stroke(Palette.track, lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: shown)
                        .stroke(row.complete ? Palette.done : Palette.signal, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    CountUp(value: row.percent, suffix: "%")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .contentTransition(.numericText())
                }
                .frame(width: 72, height: 72)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your progress").font(.label).foregroundStyle(Palette.stone)
                    Text(row.label).font(.heading)
                    Text(cheer).font(.subheadline)
                }
                Spacer(minLength: 0)
            }
            VStack(spacing: 6) {
                LiquidBar(fraction: timeFraction, fill: Palette.ink, height: 4)
                HStack {
                    Text(daysLeft).font(.footnote.weight(.medium))
                    Spacer()
                    Text(range).font(.footnote).foregroundStyle(Palette.stone)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your progress: \(row.label), \(row.percent) percent. \(daysLeft).")
        .onAppear { withAnimation(reduce ? nil : Motion.wave.delay(0.25)) { shown = min(1, row.fraction) } }
        .onChange(of: row.fraction) { _, f in withAnimation(reduce ? nil : Motion.wave) { shown = min(1, f) } }
    }
}

/**
 * What is on the line inside the app: the badge the winner wears on their avatar, and the one last place
 * has to. Two tiles side by side, so the choice between them is obvious at a glance.
 */
private struct StakesCard: View {
    var stakes: Stakes
    /** Whether to mention the medal still to be earned. */
    var medal: Bool

    var body: some View {
        Card {
            HStack(spacing: Metrics.gap) {
                tile(stakes.reward, title: stakes.solo ? "Finish it" : "Win it", reward: true)
                Divider().frame(height: 40)
                tile(stakes.forfeit, title: stakes.solo ? "Miss it" : "Come last", reward: false)
            }
            Text((stakes.reward.days == stakes.forfeit.days
                  ? "Worn on your avatar for \(stakes.reward.days) days, where everyone sees it."
                  : "Worn on your avatar where everyone sees it: \(stakes.reward.days) days for the good one, \(stakes.forfeit.days) for the other.")
                 + (medal ? " Reach your goal and there's a medal too." : ""))
                .font(.footnote).foregroundStyle(Palette.stone)
        }
    }

    private func tile(_ badge: Badge, title: String, reward: Bool) -> some View {
        HStack(spacing: 10) {
            // A sample avatar wearing it, so it is clear where the badge goes.
            AvatarView(person: Person(id: "", name: reward ? "W" : "L", avatar: reward ? 1 : 3, flair: Flair(emoji: badge.emoji, kind: reward ? "reward" : "forfeit")), size: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(title.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(reward ? Color(red: 0.86, green: 0.60, blue: 0.13) : Palette.stone)
                Text(badge.title).font(.subheadline.weight(.semibold)).lineLimit(2).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/** Your own days in the challenge as bars, the pace to hold, and how today compares with yesterday. */
private struct TimelineCard: View {
    var timeline: Timeline

    private var numeric: Bool { timeline.pace != nil }

    var body: some View {
        Card {
            HStack(alignment: .firstTextBaseline) {
                Text("📈 Your timeline").font(.label).foregroundStyle(Palette.stone).accessibilityLabel("Your timeline")
                Spacer()
                Text("Goal: \(timeline.goalText)").font(.footnote).foregroundStyle(Palette.stone)
            }
            if let text = timeline.trendText {
                HStack(spacing: 6) {
                    if let trend = timeline.trend {
                        Image(systemName: trend == "up" ? "arrow.up.right.circle.fill" : trend == "down" ? "arrow.down.right.circle.fill" : "equal.circle.fill")
                            .foregroundStyle(trend == "up" ? Palette.done : trend == "down" ? Palette.accent : Palette.stone)
                    }
                    Text(text).font(.headline)
                }
            }
            Chart {
                ForEach(timeline.days) { day in
                    BarMark(x: .value("Day", day.date), y: .value(timeline.unit, numeric ? day.amount : (day.amount > 0 ? 1 : 0)), width: .ratio(0.62))
                        .foregroundStyle(day.today ? Palette.accent : Palette.accent.opacity(0.45))
                        .cornerRadius(3)
                }
                if let pace = timeline.pace {
                    RuleMark(y: .value("Pace", pace))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .foregroundStyle(Palette.stone)
                        .annotation(position: .top, alignment: .trailing) {
                            Text("\(Catalog.fmt(pace)) a day").font(.caption2).foregroundStyle(Palette.stone)
                        }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let date = value.as(String.self), let day = timeline.days.first(where: { $0.date == date }) {
                            Text(day.label).font(.caption2).foregroundStyle(day.today ? Palette.ink : Palette.faint).fontWeight(day.today ? .bold : .regular)
                        }
                    }
                }
            }
            .chartYAxis(numeric ? .automatic : .hidden)
            .chartYScale(domain: .automatic(includesZero: true))
            .frame(height: numeric ? 130 : 54)
            if let best = timeline.bestText {
                Text(best).font(.footnote).foregroundStyle(Palette.stone)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/** The challenge's chat: the last few lines, a few ready-made jabs, and a line to write your own. */
private struct TalkCard: View {
    var detail: ChallengeDetail
    var lines: [TalkLine]
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?
    @State private var showAll = false

    private let jabs = ["You're going down 😤", "Catch me if you can 🏃", "Who's buying? 👀", "Nice one 👏", "Where you at? 🦗"]

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            HStack(alignment: .firstTextBaseline) {
                Text("💬 Chat").font(.heading).accessibilityLabel("Chat")
                Spacer()
                if lines.count > 4 {
                    Button(showAll ? "Show less" : "All \(lines.count)") { withAnimation(Motion.fluid) { showAll.toggle() } }.font(.label)
                }
            }
            VStack(alignment: .leading, spacing: 12) {
                if lines.isEmpty {
                    Text("Nobody's said a word yet. Go first.").foregroundStyle(Palette.stone)
                }
                ForEach(showAll ? lines : Array(lines.suffix(4)), id: \.lineId) { line in
                    HStack(alignment: .top, spacing: 10) {
                        if !line.mine { AvatarView(person: line.person, size: 30) } else { Spacer(minLength: 40) }
                        VStack(alignment: line.mine ? .trailing : .leading, spacing: 2) {
                            if !line.mine { Text(line.name).font(.caption.weight(.semibold)).foregroundStyle(Palette.stone) }
                            Text(line.text)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .foregroundStyle(line.mine ? .white : Palette.ink)
                                .background(line.mine ? Palette.signal : Palette.inset, in: .rect(cornerRadius: 16))
                        }
                        if !line.mine { Spacer(minLength: 40) }
                    }
                    .transition(.liquid)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(jabs, id: \.self) { jab in
                            Button(jab) { Task { await send(jab) } }
                                .font(.footnote.weight(.medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .foregroundStyle(Palette.ink)
                                .background(Palette.inset, in: .capsule)
                        }
                    }
                }
                HStack(spacing: 8) {
                    TextField("Say something", text: $text, axis: .vertical)
                        .lineLimit(1...3)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Palette.inset, in: .rect(cornerRadius: 18))
                    Button { Task { await send(text) } } label: {
                        Image(systemName: "arrow.up.circle.fill").font(.system(size: 32)).foregroundStyle(text.trimmed.isEmpty ? Palette.faint : Palette.signal)
                    }
                    .disabled(text.trimmed.isEmpty || busy)
                    .accessibilityLabel("Send")
                }
                ErrorLine(text: error)
            }
            .padding(Metrics.card - 4)
            .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        }
        .animation(Motion.fluid, value: lines)
    }

    private func send(_ words: String) async {
        let words = String(words.trimmed.prefix(160))
        guard !words.isEmpty, !busy else { return }
        busy = true
        error = nil
        do {
            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)/talk", body: ["text": words])
            if words == text.trimmed { text = "" }
            Haptic.tap()
            onChange(next)
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}

/** What finishing earns you: the medal, locked until then and struck once it is yours. */
private struct RewardCard: View {
    var detail: ChallengeDetail
    @State private var landed = false

    var body: some View {
        let earned = MedalView.kind(detail.you.medal)
        let done = detail.status == "done"
        if done && earned == nil {
            EmptyView()
        } else {
            Card {
                HStack(spacing: Metrics.card) {
                    MedalView(kind: earned ?? .locked, emoji: Catalog.emoji(detail.type), size: 64)
                        .scaleEffect(landed || earned == nil ? 1 : 0.4)
                        .rotationEffect(.degrees(landed || earned == nil ? 0 : -30))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(earned == nil ? "Reward" : "Medal unlocked").font(.label).foregroundStyle(Palette.stone)
                        Text("\(detail.name) medal").font(.heading)
                        Text(line(earned)).font(.subheadline)
                    }
                    Spacer(minLength: 0)
                }
            }
            .onAppear { withAnimation(.spring(response: 0.5, dampingFraction: 0.5).delay(0.5)) { landed = true } }
            .accessibilityElement(children: .combine)
        }
    }

    private func line(_ earned: MedalView.Kind?) -> String {
        switch earned {
        case .gold: "Gold, for winning it. It's on your Me page."
        case .goal: "Earned by reaching your goal. It's on your Me page."
        default: detail.standings.count >= 2 ? "Reach your goal to unlock it. Finish first and it's gold." : "Reach your goal to unlock it."
        }
    }
}

/** On a steps challenge: whether the phone is counting for you, and the way to turn that on. */
private struct StepsNote: View {
    @Environment(Router.self) private var router
    private var steps: StepSync { StepSync.shared }

    var body: some View {
        if steps.available {
            HStack(spacing: Metrics.gap) {
                Text("👟").font(.title2).accessibilityHidden(true)
                if steps.enabled {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Steps count themselves").font(.label)
                        Text(steps.today.map { "\(Catalog.fmt(Double($0))) today, from your iPhone." } ?? "Read from your iPhone when you open Rally.")
                            .font(.footnote).foregroundStyle(Palette.stone)
                    }
                    Spacer(minLength: 0)
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Let your iPhone count for you").font(.label)
                        Text("No typing in step counts.").font(.footnote).foregroundStyle(Palette.stone)
                    }
                    Spacer(minLength: 0)
                    SecondaryButton(title: "Turn on", compact: true) { StepSync.shared.enabled = true }
                }
            }
            .padding(.horizontal, Metrics.card)
            .padding(.vertical, 14)
            .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        }
    }
}

private struct HeroStat: View {
    var value: String
    var label: String
    var stacked: Bool

    var body: some View {
        Group {
            if stacked {
                HStack {
                    Text(label).font(.footnote).foregroundStyle(Palette.stone)
                    Spacer()
                    Text(value).font(.heading)
                }
            } else {
                VStack(spacing: 2) {
                    Text(value).font(.heading).lineLimit(1).minimumScaleFactor(0.6).contentTransition(.numericText())
                    Text(label).font(.footnote).foregroundStyle(Palette.stone)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 16)
        .padding(.horizontal, stacked ? Metrics.card : 8)
        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        .accessibilityElement(children: .combine)
    }
}

private struct StandingRow: View {
    var row: Standing
    var medals = false
    private var medal: String? { medals && (1...3).contains(row.rank) && row.percent > 0 ? ["🥇", "🥈", "🥉"][row.rank - 1] : nil }

    /** The trend a fact describes, as a symbol: rising, falling, steady, or a run of days. */
    private static func trend(for fact: String) -> (symbol: String, color: Color) {
        let f = fact.lowercased()
        if f.hasPrefix("up ") || f.hasPrefix("best day") || f.hasPrefix("first one") { return ("chart.line.uptrend.xyaxis", Palette.done) }
        if f.hasPrefix("down ") || f.hasPrefix("quiet") || f.hasPrefix("yet to") { return ("chart.line.downtrend.xyaxis", Palette.accent) }
        if f.contains("in a row") || f.contains("missed a day") { return ("flame.fill", Palette.accent) }
        return ("chart.line.flattrend.xyaxis", Palette.stone)
    }

    var body: some View {
        HStack(spacing: 10) {
            if let medal {
                Text(medal).font(.title3).frame(width: 26).popIn(delay: 0.4 + Double(row.rank) * 0.12).accessibilityHidden(true)
            } else {
                Text("\(row.rank)")
                    .font(.caption.weight(.semibold))
                    .frame(width: 22, height: 22)
                    .overlay(Circle().strokeBorder(Palette.line, lineWidth: 1.5))
                    .frame(width: 26)
            }
            AvatarView(person: row.person, size: 40)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(row.name).font(.label).lineLimit(1)
                    if row.onTheHook {
                        Text("🪝 On the hook").font(.caption.weight(.medium)).foregroundStyle(Palette.accent)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Palette.signalTint, in: .capsule)
                    }
                    Spacer(minLength: 4)
                    Text("\(row.percent)%").font(.label).contentTransition(.numericText())
                }
                LiquidBar(fraction: row.fraction, fill: row.complete ? Palette.done : Palette.signal, height: 8)
                HStack(spacing: 10) {
                    Text(row.label)
                    Spacer(minLength: 0)
                    if let delta = row.delta {
                        Label("\(delta) this week", systemImage: delta.hasPrefix("-") ? "arrow.down.right" : "arrow.up.right")
                    }
                }
                .font(.footnote)
                .foregroundStyle(Palette.stone)
                if let fact = row.fact {
                    let trend = Self.trend(for: fact)
                    Label { Text(fact).foregroundStyle(Palette.stone) } icon: { Image(systemName: trend.symbol).foregroundStyle(trend.color) }
                        .font(.footnote)
                        .padding(.top, 2)
                        .accessibilityLabel(fact)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 16)
        .overlay(RoundedRectangle(cornerRadius: Metrics.radius - 4).strokeBorder(row.isYou ? Palette.ink : .clear, lineWidth: 1.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rank \(row.rank). \(row.name)\(row.isYou ? ", you" : ""). \(row.percent) percent. \(row.label).\(row.onTheHook ? " On the hook." : "") \(row.fact ?? "")")
    }
}

// ---------- sheets ----------

private struct ProposeSheet: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.gap * 1.5) {
                Text("Consequence for last place?").font(.heading)
                ConsequencePicker(value: $draft, context: "\(detail.name), \(detail.targetText)", type: detail.type)
                Text("Your crew votes on this. No money, nothing mean.").font(.footnote).foregroundStyle(Palette.stone)
                ErrorLine(text: error)
                PrimaryButton(title: "Propose it", busy: busy, disabled: draft.trimmed.isEmpty || Copy.consequenceProblem(draft) != nil) {
                    Task {
                        busy = true
                        do {
                            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)/consequence", body: ["text": draft])
                            onChange(next)
                            Toaster.shared.confirm("🎯", "Proposed to your crew")
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
        .presentationDetents([.medium, .large])
    }
}

private struct InviteSheet: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var adding: String?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.gap) {
                Text("Invite your crew").font(.heading)
                if let addable = detail.addable, !addable.isEmpty {
                    // People already in your crew go straight in: no link to send, nothing for them to tap.
                    VStack(spacing: 0) {
                        ForEach(addable) { p in
                            HStack(spacing: Metrics.gap) {
                                AvatarView(person: p, size: 36)
                                Text(p.name).font(.label)
                                Spacer()
                                SecondaryButton(title: "Add", symbol: "plus", busy: adding == p.id, compact: true) { Task { await add(p) } }
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    .padding(.horizontal, Metrics.card)
                    .padding(.vertical, 6)
                    .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
                    ErrorLine(text: error)
                    Text("Or invite someone new").font(.label).padding(.top, 4)
                }
                InviteComposer(
                    spec: .init(type: detail.type, target: detail.target, per: detail.per, lengthDays: detail.lengthDays, name: detail.name, consequence: detail.consequence?.text),
                    getToken: {
                        let r: TokenResponse = try await api.send("/challenges/\(detail.id)/invite", body: [:])
                        return r.token
                    },
                    onFinish: { dismiss() })
            }
            .padding(Metrics.screen)
        }
        .presentationDetents([.medium, .large])
        .animation(Motion.fluid, value: detail.addable)
    }

    private func add(_ p: Person) async {
        adding = p.id
        error = nil
        do {
            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)/add", body: ["userIds": [p.id]])
            Toaster.shared.confirm("🙌", "\(p.name) is in")
            onChange(next)
        } catch {
            self.error = error.localizedDescription
        }
        adding = nil
    }
}

private struct ManageSheet: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @Environment(\.dismiss) private var dismiss
    @State private var busy: String?
    @State private var error: String?
    @State private var confirmEnd = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if detail.manage.isEmpty {
                        Text("Nobody else is in yet.").foregroundStyle(Palette.stone)
                    }
                    ForEach(detail.manage) { p in
                        HStack {
                            AvatarView(person: p.person, size: 36)
                            Text(p.name)
                            Spacer()
                            if p.pending {
                                Text("Alert sent").font(.footnote).foregroundStyle(Palette.stone)
                            } else if busy == p.id {
                                ProgressView()
                            } else {
                                Button("Remove", role: .destructive) { Task { await act(p.id, "/removals", ["userId": p.id]) } }
                            }
                        }
                    }
                } header: {
                    Text("Remove someone")
                } footer: {
                    Text("Your crew gets an alert first. They're removed after a day unless they log.")
                }
                Section {
                    Toggle(isOn: Binding(get: { detail.shared == true }, set: { on in Task { await act("share", "/share", ["shared": on]) } })) {
                        Label("Friends of the crew can join", systemImage: "person.2.badge.plus")
                    }
                    .tint(Palette.signal)
                } footer: {
                    Text("When this is on, friends of anyone in the challenge see it on their Home and can join. Off keeps it invite only.")
                }
                if let error { Section { ErrorLine(text: error) } }
                Section {
                    Button("End challenge early", role: .destructive) { confirmEnd = true }
                }
            }
            .navigationTitle("Manage challenge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done", systemImage: "checkmark") { dismiss() } } }
            .confirmationDialog("End it now?", isPresented: $confirmEnd, titleVisibility: .visible) {
                Button("End challenge", role: .destructive) { Task { if await act("end", "/end") { dismiss() } } }
                Button("Keep going", role: .cancel) {}
            } message: {
                Text("Standings lock and results are final.")
            }
        }
    }

    @discardableResult
    private func act(_ key: String, _ path: String, _ body: [String: Any] = [:]) async -> Bool {
        busy = key
        defer { busy = nil }
        do {
            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)\(path)", body: body)
            onChange(next)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}

/** The last name punishment, once the challenge is over. */
struct RenameCard: View {
    var detail: ChallengeDetail
    var onChange: (ChallengeDetail) -> Void
    @Environment(API.self) private var api
    @State private var drafts: [String: String] = [:]
    @State private var busy: String?
    @State private var error: String?

    var body: some View {
        if let rename = detail.rename {
            let winner = detail.winnerName ?? "The winner"
            Card {
                Text(rename.canSet ? "Pick a new last name" : "New last name").font(.heading)
                ForEach(rename.targets) { t in
                    switch t.status {
                    case "active":
                        Text("\(t.isYou ? "You're \(t.newName ?? "")" : "\(t.name) is now \(t.newName ?? "")") until \(Copy.shortDate(t.until ?? "")).")
                    case "over":
                        Text("\(t.isYou ? "Your" : "\(t.name)'s") new last name has run its course.")
                    default:
                        if !rename.canSet {
                            Text("\(winner) gets to pick \(t.isYou ? "your" : "\(t.name)'s") new last name.")
                        } else {
                            let draft = drafts[t.id] ?? ""
                            let valid = Copy.cleanLastName(draft) != nil
                            VStack(alignment: .leading, spacing: 8) {
                                Text("\(t.name) is on the hook. Give \(t.name) any last name you like. It lasts a week.")
                                RallyField(placeholder: "New last name", text: Binding(get: { drafts[t.id] ?? "" }, set: { drafts[t.id] = $0; error = nil }), capitalization: .words, maxLength: 20)
                                ErrorLine(text: !draft.trimmed.isEmpty && !valid ? "Letters only, up to 20." : error)
                                PrimaryButton(title: "Change \(t.name)'s last name", busy: busy == t.id, disabled: !valid) {
                                    Task {
                                        busy = t.id
                                        do {
                                            let next: ChallengeDetail = try await api.send("/challenges/\(detail.id)/rename", body: ["userId": t.id, "lastName": draft])
                                            Haptic.success()
                                            onChange(next)
                                        } catch {
                                            self.error = error.localizedDescription
                                        }
                                        busy = nil
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
