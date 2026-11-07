import SwiftUI

/**
 * Debug builds only: `xcrun simctl launch booted com.jean.fitnesschallenge -RallyDemo YES` opens this
 * page of the water, 3D and celebration pieces, so they can be checked without logging or ending a real
 * challenge. `-RallyDemo YES -RallyDemoFun YES` shows the playful pieces instead.
 */
struct DebugDemo: View {
    /** `-RallyWelcome YES` shows the signed-out welcome without signing anyone out. */
    static var welcome: Bool { flag("RallyWelcome") }

    /** Any debug-only launch flag, always off in release builds. */
    static func flag(_ name: String) -> Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: name)
        #else
        false
        #endif
    }

    static var requested: Bool { flag("RallyDemo") }

    @State private var fraction = 0.25
    @State private var level = 0.0
    @State private var tick = 0
    @State private var party = 0
    @State private var backdropStyle = UserDefaults.standard.integer(forKey: "RallyBackdrop")
    @State private var backdropDark = !DebugDemo.flag("RallyLight")
    @State private var demoDraft: WorkoutDraft = {
        var d = WorkoutDraft()
        d.minutes = 45
        d.exercises = [ExerciseDraft(name: "Squat", sets: "3", reps: "8", weight: "135")]
        return d
    }()

    var body: some View {
        if Self.flag("RallyDemoBackdrop") { backdrops } else if Self.flag("RallyDemoFlow") { flow } else if Self.flag("RallyDemoLog") { log } else if Self.flag("RallyDemoWin") { win } else if Self.flag("RallyDemoFun") { fun } else { water }
    }

    /**
     * `-RallyDemo YES -RallyDemoWin YES`: a finished challenge that you won, built from made-up data and
     * never sent to the server. A fresh id each launch, so the once-per-challenge party always plays.
     */
    private var win: some View {
        NavigationStack {
            if let detail = Self.wonChallenge { ChallengeContent(detail: detail, onChange: { _ in }) }
        }
    }

    private static var wonChallenge: ChallengeDetail? {
        let json = """
        {
          "id": "demo-win-\(Int.random(in: 0..<1_000_000))", "name": "Walk it off", "targetText": "3 walks a week for 2 weeks.",
          "type": "walk", "target": 3, "per": "week", "lengthDays": 14, "numeric": false, "house": false,
          "status": "done", "daysLeftText": "Ended", "timeFraction": 1, "rangeText": "Sept 25 to Oct 8",
          "consequence": {"status": "agreed", "text": "Buys coffee", "proposedBy": "Dana", "youProposed": false, "youAgreed": true, "waitingOn": 0},
          "rename": null,
          "stakes": {"reward": {"emoji": "👟", "title": "Golden shoes", "days": 7}, "forfeit": {"emoji": "🐌", "title": "Snail", "days": 7}, "solo": false},
          "hero": {"rank": "1st", "progress": "6 of 6", "people": "4"},
          "fair": false, "yourGoalText": null, "winnerName": "Jean",
          "resultText": "You won and wear the Golden shoes for 7 days. Sam finished last, wears the Snail and buys coffee.",
          "standings": [
            {"id": "u1", "name": "Jean", "avatar": 1, "rank": 1, "fraction": 1, "percent": 100, "label": "6 of 6", "goalText": null, "delta": "+1", "isYou": true, "onTheHook": false, "complete": true, "flair": {"emoji": "👟", "kind": "reward"}},
            {"id": "u2", "name": "Dana", "avatar": 2, "rank": 2, "fraction": 0.83, "percent": 83, "label": "5 of 6", "goalText": null, "delta": "-1", "isYou": false, "onTheHook": false, "complete": false},
            {"id": "u3", "name": "Priya", "avatar": 4, "rank": 3, "fraction": 0.67, "percent": 67, "label": "4 of 6", "goalText": null, "delta": null, "isYou": false, "onTheHook": false, "complete": false},
            {"id": "u4", "name": "Sam", "avatar": 5, "rank": 4, "fraction": 0.33, "percent": 33, "label": "2 of 6", "goalText": null, "delta": null, "isYou": false, "onTheHook": true, "complete": false, "flair": {"emoji": "🐌", "kind": "forfeit"}}
          ],
          "members": [
            {"id": "u1", "name": "Jean", "avatar": 1, "flair": {"emoji": "👟", "kind": "reward"}}, {"id": "u2", "name": "Dana", "avatar": 2},
            {"id": "u3", "name": "Priya", "avatar": 4}, {"id": "u4", "name": "Sam", "avatar": 5, "flair": {"emoji": "🐌", "kind": "forfeit"}}
          ],
          "alerts": [],
          "you": {"member": true, "commissioner": false, "readOnly": true, "result": "won", "loggedToday": false, "medal": "gold"},
          "manage": []
        }
        """
        return try? JSONDecoder().decode(ChallengeDetail.self, from: Data(json.utf8))
    }

    /**
     * `-RallyDemo YES -RallyDemoBackdrop YES -RallyBackdrop 1`: a backdrop being considered, behind a page
     * that looks like Home, so it can be judged before it replaces the real one. 0 is the current backdrop.
     */
    private var backdrops: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.gap * 2) {
                // Switch between the candidates and light or dark without relaunching.
                Picker("Backdrop", selection: $backdropStyle) {
                    Text("Now").tag(0)
                    Text("Sole").tag(1)
                    Text("Banner").tag(3)
                    Text("Rally").tag(4)
                }
                .pickerStyle(.segmented)
                Picker("Appearance", selection: $backdropDark) {
                    Text("Dark").tag(true)
                    Text("Light").tag(false)
                }
                .pickerStyle(.segmented)
                .onChange(of: backdropDark) { _, dark in Appearance.apply(dark ? .dark : .light) }
                Text("Afternoon, Jean. 👋").font(.display)
                HStack(spacing: Metrics.gap) {
                    ForEach(["D", "P", "S"], id: \.self) { n in
                        Circle().fill(Palette.card).frame(width: 56, height: 56).overlay(Text(n).font(.headline))
                    }
                    Spacer()
                }
                Text("Your challenges").font(.heading)
                ForEach(["Gym challenge", "Walking challenge"], id: \.self) { name in
                    HStack(spacing: Metrics.gap) {
                        EmojiBadge(emoji: name.hasPrefix("Gym") ? "🏋️" : "🚶")
                        VStack(alignment: .leading, spacing: 2) {
                            Text(name).font(.headline)
                            Text("3 a week").font(.subheadline).foregroundStyle(Palette.stone)
                        }
                        Spacer()
                    }
                    .padding(Metrics.card)
                    .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
                }
            }
            .padding(.horizontal, Metrics.screen)
            .padding(.top, 8)
        }
        .background { CandidateBackdrop(style: backdropStyle) }
    }

    /** `-RallyDemo YES -RallyDemoFlow YES`: the logging flow on made-up data, opened at "what did you do" with a trail run picked. */
    private var flow: some View {
        LogFlow(data: CheckinData(checkedIn: false, streak: 3, challenges: [
            CheckinChallenge(id: "c1", name: "Miles challenge", type: "miles", numeric: true, unitMany: "miles", loggedToday: false, progressText: "2 of 10 miles this week"),
            CheckinChallenge(id: "c2", name: "Minutes challenge", type: "minutes", numeric: true, unitMany: "minutes", loggedToday: false, progressText: "40 of 150 minutes this week"),
        ], workouts: [
            WorkoutOption(key: "road_run", label: "Road run", emoji: "🏃", activity: "run", unit: "mi", ask: "How far?", whole: false, max: 300),
            WorkoutOption(key: "trail_run", label: "Trail run", emoji: "🌲", activity: "run", unit: "mi", ask: "How far?", whole: false, max: 300),
            WorkoutOption(key: "treadmill_run", label: "Treadmill run", emoji: "🏃‍♂️", activity: "run", unit: "mi", ask: "How far?", whole: false, max: 300),
            WorkoutOption(key: "track_run", label: "Track run", emoji: "🏟️", activity: "run", unit: "laps", ask: "How many laps?", whole: true, max: 1000),
            WorkoutOption(key: "sprints", label: "Sprints", emoji: "⚡️", activity: "run", unit: "rounds", ask: "How many rounds?", whole: true, max: 200),
        ]), preset: "c1", onFinish: {}, demo: true)
    }

    /** `-RallyDemo YES -RallyDemoLog YES`: the workout detail fields, a log row and the medals. */
    private var log: some View {
        Page {
            HStack(alignment: .bottom, spacing: 18) {
                MedalView(kind: .gold, emoji: "🏃")
                MedalView(kind: .goal, emoji: "🏋️")
                MedalView(kind: .locked, emoji: "")
            }
            WorkoutRow(workout: Workout(
                id: "w1", date: "2026-10-11", dateText: "Sunday, Oct 11", activity: "gym", activityLabel: "Gym", minutes: 45,
                note: "Leg day. Felt strong.", exercises: [Exercise(name: "Squat", sets: 3, reps: 8, weight: 135), Exercise(name: "Leg press", sets: 3, reps: 10, weight: 270)],
                shared: true, countedToward: ["Gym challenge"]))
            Card { WorkoutDetailFields(draft: $demoDraft) }
        }
    }

    private var fun: some View {
        Page {
            HStack { Text("Fun").font(.display); WavingHand().font(.display) }
            SwipeCard { _ in }
            HStack(spacing: 20) {
                EmojiBadge(emoji: "🏃").popIn(delay: 0.4)
                EmojiBadge(emoji: "🏋️").bobbing()
                CountUp(value: 87, suffix: "%").font(.heading)
                Spacer()
            }
            Text("Banner").frame(maxWidth: .infinity, minHeight: 60).background { AliveGradient() }.clipShape(.rect(cornerRadius: 24))
            PrimaryButton(title: "Party") { party += 1 }
        }
        .background { FloatingEmoji(emoji: ["💪", "🔥", "🎉", "⭐️", "👟"]) }
        .overlay { ConfettiBurst(trigger: party) }
        .task {
            try? await Task.sleep(for: .seconds(2.5))
            party += 1
        }
    }

    private var water: some View {
        Page {
            Text("Water and 3D").font(.display)
            Card { Trophy3D(height: 200).frame(maxWidth: .infinity) }
            Card {
                LiquidBar(fraction: fraction)
                LiquidBar(fraction: fraction * 0.6, fill: Palette.ink, height: 8)
                SecondaryButton(title: "Pour", compact: true) { fraction = fraction > 0.8 ? 0.15 : fraction + 0.3 }
            }
            HStack { Spacer(); WaterCircle(level: level, size: 120) { Image(systemName: "checkmark").font(.system(size: 50, weight: .bold)).foregroundStyle(.white) }; Spacer() }
            PrimaryButton(title: "Ripple me") {}
                .modifier(RippleModifier(trigger: tick, origin: CGPoint(x: 120, y: 27)))
        }
        .onAppear { withAnimation(.easeOut(duration: 1.4)) { level = 1 } }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.5))
                tick += 1
            }
        }
    }
}

/** Backdrops being tried out. Only the debug page above draws these; the app still uses `WaterBackdrop`. */
private struct CandidateBackdrop: View {
    var style: Int
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        Group {
            switch style {
            case 0: WaterBackdrop()
            case 3: BannerBackdrop(dark: dark)
            case 4: RallyBackdrop(dark: dark)
            default:
                TimelineView(.animation(minimumInterval: 1 / 30)) { ctx in
                    let t = ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3600)
                    Rectangle()
                        .fill(Palette.page)
                        .visualEffect { [dark] view, proxy in
                            let size = Shader.Argument.float2(proxy.size), time = Shader.Argument.float(t), tint = Shader.Argument.color(Palette.accent)
                            return view.colorEffect(ShaderLibrary.sole(size, time, tint, .float(dark ? 0.8 : 0.5)))
                        }
                }
            }
        }
        .ignoresSafeArea()
    }
}

/**
 * Banner: the app's own words, huge and faint, sliding past behind everything like the boards round a
 * stadium. Two rows, tilted, moving opposite ways.
 */
private struct BannerBackdrop: View {
    var dark: Bool
    private let rows = ["RALLY  ·  SHOW UP  ·  LOCK IN  ·  ", "ONE MORE  ·  NO DAYS OFF  ·  KEEP GOING  ·  ", "RALLY  ·  TOGETHER  ·  AGAIN  ·  "]

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            Canvas { g, size in
                g.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Palette.page))
                g.translateBy(x: size.width / 2, y: 0)
                g.rotate(by: .degrees(-9))
                for (i, words) in rows.enumerated() {
                    let filled = i == 1
                    let text = g.resolve(Text(words + words)
                        .font(.system(size: 92, weight: .black, design: .rounded).width(.condensed))
                        .foregroundStyle(Palette.accent.opacity(filled ? (dark ? 0.20 : 0.13) : (dark ? 0.09 : 0.06))))
                    let width = text.measure(in: CGSize(width: 1e5, height: 200)).width / 2
                    let speed = (i % 2 == 0 ? 18.0 : -24.0)
                    var x = (t * speed).truncatingRemainder(dividingBy: width)
                    if x > 0 { x -= width }
                    g.draw(text, at: CGPoint(x: x - size.width, y: 90 + Double(i) * 104), anchor: .leading)
                }
            }
            // Fades out down the page so the cards sit on a clean surface.
            .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: UnitPoint(x: 0.5, y: 0.62)))
            .background(Palette.page)
        }
    }
}

/**
 * Rally: a point of light knocked back and forth across the top of the page, the way a rally goes in
 * tennis, leaving the arc of each shot behind it for a moment.
 */
private struct RallyBackdrop: View {
    var dark: Bool

    /** Where the ball is at time `t`: one shot every 1.7 seconds, each landing at a different depth. */
    private func ball(_ t: Double, in size: CGSize) -> CGPoint {
        let shot = 1.7
        let n = floor(t / shot), f = t / shot - n
        func depth(_ k: Double) -> Double { 0.16 + 0.20 * (sin(k * 2.399) * 0.5 + 0.5) }
        let leftToRight = Int(n) % 2 == 0
        let x0 = leftToRight ? 0.06 : 0.94, x1 = leftToRight ? 0.94 : 0.06
        let y0 = depth(n), y1 = depth(n + 1)
        let lift = 0.13 + 0.05 * sin(n * 1.3)
        let x = x0 + (x1 - x0) * f
        let y = y0 + (y1 - y0) * f - lift * 4 * f * (1 - f)
        return CGPoint(x: x * size.width, y: y * size.width + 40)
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            Canvas { g, size in
                let strength = dark ? 1.0 : 0.75
                // The last few shots, fading with age.
                let steps = 220, span = 5.6
                for i in 0..<steps {
                    let age = Double(i) / Double(steps)
                    let a = ball(t - age * span, in: size), b = ball(t - (age + 1.0 / Double(steps)) * span, in: size)
                    guard abs(a.x - b.x) < size.width * 0.3 else { continue }
                    var seg = Path()
                    seg.move(to: a)
                    seg.addLine(to: b)
                    let fade = pow(1 - age, 2.2)
                    g.stroke(seg, with: .color(Palette.accent.opacity(0.55 * fade * strength)), style: StrokeStyle(lineWidth: 1 + 3.5 * fade, lineCap: .round))
                }
                let p = ball(t, in: size)
                g.fill(Path(ellipseIn: CGRect(x: p.x - 22, y: p.y - 22, width: 44, height: 44)), with: .radialGradient(
                    Gradient(colors: [Palette.accent.opacity(0.45 * strength), .clear]), center: p, startRadius: 0, endRadius: 22))
                g.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)), with: .color(Palette.accent))
            }
            .background(Palette.page)
        }
    }
}
