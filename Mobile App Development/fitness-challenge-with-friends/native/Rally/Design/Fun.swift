import CoreHaptics
import SwiftUI

// The playful layer: celebration and small signs of life. Everything here is decoration, so it is hidden
// from VoiceOver and stands still (or does not appear) when Reduce Motion is on.

/** Repeatable randomness, so a particle keeps its own path from frame to frame. */
private struct Dice {
    var state: UInt64
    init(_ seed: Int) { state = UInt64(truncatingIfNeeded: seed) &* 0x9E3779B97F4A7C15 | 1 }
    mutating func next() -> Double {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return Double(state % 100_000) / 100_000
    }
    mutating func between(_ a: Double, _ b: Double) -> Double { a + (b - a) * next() }
}

// ---------- confetti ----------

/**
 * A party popper: paper and emoji thrown up from the bottom of the view, tumbling as they fall. Drawn in
 * one Canvas pass per frame, so a hundred pieces cost about the same as one. Fires each time `trigger`
 * changes.
 */
struct ConfettiBurst: View {
    var trigger: Int
    var emoji: [String] = ["🎉", "💪", "🔥"]
    var pieces = 130

    @State private var start: Date?
    @State private var seed = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    private let colors: [Color] = [Palette.signal, Palette.accent, .orange, .yellow, Palette.done, .pink, Palette.water]
    private let life = 3.8

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60, paused: start == nil)) { timeline in
            Canvas { context, size in
                guard let start else { return }
                let t = timeline.date.timeIntervalSince(start)
                guard t < life else { return }
                let glyphs = emoji.map { context.resolve(Text($0).font(.system(size: 26))) }
                for i in 0..<pieces {
                    var dice = Dice(seed &+ i &* 7919)
                    // Two poppers, one in each bottom corner, aimed up and inward.
                    let left = i % 2 == 0
                    let origin = CGPoint(x: left ? size.width * 0.08 : size.width * 0.92, y: size.height * 0.95)
                    let angle = dice.between(left ? -1.45 : -2.6, left ? -0.55 : -1.7)
                    let speed = dice.between(size.height * 1.0, size.height * 2.1)
                    let drag = dice.between(0.6, 1.0)
                    let spin = dice.between(-9, 9)
                    let delay = dice.between(0, 0.18)
                    let scale = dice.between(0.7, 1.25)
                    let tt = max(0, t - delay)
                    // Fast out of the popper, then air resistance takes over and gravity brings it down.
                    let travel = (1 - exp(-tt / drag)) * drag
                    let x = origin.x + cos(angle) * speed * travel + sin(tt * 3 + Double(i)) * 10
                    let y = origin.y + sin(angle) * speed * travel + 0.5 * size.height * 0.36 * tt * tt
                    let fade = min(1, max(0, (life - t) / 0.9))
                    var layer = context
                    layer.opacity = fade
                    layer.translateBy(x: x, y: y)
                    layer.rotate(by: .radians(spin * tt))
                    if !glyphs.isEmpty, i % 5 == 0 {
                        layer.scaleBy(x: scale, y: scale)
                        layer.draw(glyphs[(i / 5) % glyphs.count], at: .zero)
                    } else {
                        // Paper seen edge-on thins as it tumbles.
                        let flip = abs(cos(tt * dice.between(4, 9)))
                        let w = 9 * scale, h = 14 * scale * max(0.15, flip)
                        layer.fill(Path(roundedRect: CGRect(x: -w / 2, y: -h / 2, width: w, height: h), cornerRadius: 2),
                                   with: .color(colors[i % colors.count]))
                    }
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: trigger) { _, _ in
            guard !reduce else { return }
            seed = Int.random(in: 0..<1_000_000)
            start = .now
            Celebration.play()
            DispatchQueue.main.asyncAfter(deadline: .now() + life + 0.1) {
                if let s = start, Date.now.timeIntervalSince(s) >= life { start = nil }
            }
        }
    }
}

// ---------- drifting emoji ----------

/** Emoji rising slowly behind a screen, like bubbles: there, but never in the way. */
struct FloatingEmoji: View {
    var emoji: [String]
    var count = 14
    var opacity = 0.5
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        if reduce || emoji.isEmpty {
            Color.clear
        } else {
            TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
                Canvas { context, size in
                    let t = timeline.date.timeIntervalSinceReferenceDate
                    let glyphs = emoji.map { context.resolve(Text($0).font(.system(size: 30))) }
                    for i in 0..<count {
                        var dice = Dice(i &* 104_729 &+ 17)
                        let period = dice.between(9, 17)
                        let phase = dice.next()
                        let lane = dice.between(0.06, 0.94)
                        let scale = dice.between(0.6, 1.3)
                        let sway = dice.between(10, 28)
                        let p = (t / period + phase).truncatingRemainder(dividingBy: 1)
                        let x = size.width * lane + sin(p * .pi * 4 + Double(i)) * sway
                        let y = size.height * (1.08 - p * 1.2)
                        var layer = context
                        // Appear near the bottom, thin out toward the top.
                        layer.opacity = opacity * min(1, p * 5) * (1 - p)
                        layer.translateBy(x: x, y: y)
                        layer.rotate(by: .radians(sin(p * .pi * 2 + Double(i)) * 0.35))
                        layer.scaleBy(x: scale, y: scale)
                        layer.draw(glyphs[i % glyphs.count], at: .zero)
                    }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

// ---------- numbers that count ----------

/** A number that runs up to its value when it appears, and rolls to a new one when it changes. */
struct CountUp: View {
    var value: Int
    var suffix = ""
    @State private var shown = 0.0
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        Rolling(value: shown, suffix: suffix)
            .onAppear {
                guard !reduce else { return shown = Double(value) }
                shown = 0
                withAnimation(.easeOut(duration: 0.9).delay(0.2)) { shown = Double(value) }
            }
            .onChange(of: value) { _, v in withAnimation(reduce ? nil : .easeOut(duration: 0.6)) { shown = Double(v) } }
            .accessibilityLabel("\(value)\(suffix)")
    }

    private struct Rolling: View, Animatable {
        var value: Double
        var suffix: String
        var animatableData: Double {
            get { value }
            set { value = newValue }
        }
        var body: some View { Text("\(Int(value.rounded()))\(suffix)").monospacedDigit() }
    }
}

// ---------- small signs of life ----------

/** A hand that waves hello when it arrives. */
struct WavingHand: View {
    var emoji = "👋"
    @State private var go = false
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        Text(emoji)
            .keyframeAnimator(initialValue: 0.0, trigger: go) { view, angle in
                view.rotationEffect(.degrees(angle), anchor: .bottomTrailing)
            } keyframes: { _ in
                KeyframeTrack {
                    SpringKeyframe(18, duration: 0.18)
                    SpringKeyframe(-12, duration: 0.18)
                    SpringKeyframe(16, duration: 0.18)
                    SpringKeyframe(-8, duration: 0.18)
                    SpringKeyframe(0, duration: 0.3, spring: .bouncy)
                }
            }
            .onAppear { if !reduce { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { go.toggle() } } }
            .accessibilityHidden(true)
    }
}

private struct PopIn: ViewModifier {
    var delay: Double
    @State private var landed = false
    @Environment(\.accessibilityReduceMotion) private var reduce

    func body(content: Content) -> some View {
        content
            .scaleEffect(landed || reduce ? 1 : 0.3)
            .rotationEffect(.degrees(landed || reduce ? 0 : -25))
            .opacity(landed || reduce ? 1 : 0)
            .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.5).delay(delay)) { landed = true } }
    }
}

private struct Bobbing: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        if reduce {
            content
        } else {
            // Position worked out from the clock, with no animation attached to the view. An animator
            // here would also animate everything else about the view as it first appears, colors
            // included: a dark tile would visibly fade in from the light theme's white.
            TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
                let swing = sin(timeline.date.timeIntervalSinceReferenceDate * 2 * .pi / 3.2)
                content
                    .offset(y: -1.5 - swing * 3.5)
                    .rotationEffect(.degrees(swing * 3.5))
            }
        }
    }
}

private struct ScrollLively: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        if reduce {
            content
        } else {
            // Cards ease in from slightly small and soft as they enter the screen, and back out as they leave.
            content.scrollTransition(.interactive(timingCurve: .easeOut), axis: .vertical) { view, phase in
                view
                    .scaleEffect(phase.isIdentity ? 1 : 0.93)
                    .opacity(phase.isIdentity ? 1 : 0.55)
                    .offset(y: phase.value * 10)
            }
        }
    }
}

extension View {
    /** Lands with a little overshoot and a twist, like something dropped onto the page. */
    func popIn(delay: Double = 0) -> some View { modifier(PopIn(delay: delay)) }
    /** Floats gently up and down, forever. */
    func bobbing() -> some View { modifier(Bobbing()) }
    /** Grows into place as it scrolls on, and shrinks away as it scrolls off. */
    func scrollLively() -> some View { modifier(ScrollLively()) }
}

/** A slow, moving wash of Rally's reds and warm tones, for surfaces that should feel alive. */
struct AliveGradient: View {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduce)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let a = Float(sin(t * 0.6) * 0.18), b = Float(cos(t * 0.45) * 0.18)
            let dark = scheme == .dark
            MeshGradient(
                width: 3, height: 3,
                points: [
                    [0, 0], [0.5, 0], [1, 0],
                    [0, 0.5], [0.5 + a, 0.5 + b], [1, 0.5],
                    [0, 1], [0.5, 1], [1, 1],
                ],
                colors: dark
                    ? [Palette.signalTint, Color(red: 0.36, green: 0.10, blue: 0.14), Palette.signalTint,
                       Color(red: 0.30, green: 0.12, blue: 0.08), Color(red: 0.55, green: 0.16, blue: 0.14), Color(red: 0.34, green: 0.10, blue: 0.16),
                       Palette.signalTint, Color(red: 0.36, green: 0.13, blue: 0.08), Palette.signalTint]
                    : [Palette.signalTint, Color(red: 1.0, green: 0.86, blue: 0.80), Palette.signalTint,
                       Color(red: 1.0, green: 0.90, blue: 0.82), Color(red: 1.0, green: 0.76, blue: 0.74), Color(red: 0.99, green: 0.85, blue: 0.90),
                       Palette.signalTint, Color(red: 1.0, green: 0.88, blue: 0.84), Palette.signalTint])
        }
        .accessibilityHidden(true)
    }
}

// ---------- a celebration you can feel ----------

/** A short rising flutter with a thump at the end, through the Taptic Engine. Falls back to the system success tap. */
enum Celebration {
    private static var engine: CHHapticEngine?

    static func play() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return Haptic.success() }
        do {
            if engine == nil {
                engine = try CHHapticEngine()
                engine?.resetHandler = { try? engine?.start() }
            }
            try engine?.start()
            var events: [CHHapticEvent] = []
            for i in 0..<6 {
                let rise = Float(i) / 5
                events.append(CHHapticEvent(eventType: .hapticTransient, parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.35 + rise * 0.4),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3 + rise * 0.6),
                ], relativeTime: Double(i) * 0.07))
            }
            events.append(CHHapticEvent(eventType: .hapticTransient, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5),
            ], relativeTime: 0.52))
            try engine?.makePlayer(with: CHHapticPattern(events: events, parameters: [])).start(atTime: 0)
        } catch {
            Haptic.success()
        }
    }
}
