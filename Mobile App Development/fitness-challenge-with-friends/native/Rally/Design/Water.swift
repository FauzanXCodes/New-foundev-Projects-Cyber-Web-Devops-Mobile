import SwiftUI

// SwiftUI views and modifiers over the Metal shaders in Water.metal. All of them stand still when
// Reduce Motion is on: the water is decoration, never information.

enum Motion {
    /** The everyday spring: fluid, settles with the barest overshoot. */
    static let fluid = Animation.spring(response: 0.5, dampingFraction: 0.78)
    /** Heavier, for big surfaces, so they feel like they carry weight. */
    static let wave = Animation.spring(response: 0.7, dampingFraction: 0.72)
    /** A playful splash for arrivals and selection. */
    static let splash = Animation.spring(response: 0.42, dampingFraction: 0.58)
    /** Quick, no overshoot. Press feedback. */
    static let press = Animation.spring(response: 0.22, dampingFraction: 0.9)
}

// ---------- ripple on touch ----------

struct RippleModifier: ViewModifier {
    var trigger: Int
    var origin: CGPoint
    @Environment(\.accessibilityReduceMotion) private var reduce

    func body(content: Content) -> some View {
        if reduce {
            content
        } else {
            content.keyframeAnimator(initialValue: 0.0, trigger: trigger) { view, elapsed in
                view.modifier(RippleEffect(origin: origin, elapsed: elapsed))
            } keyframes: { _ in
                MoveKeyframe(0)
                LinearKeyframe(1.1, duration: 1.1)
            }
        }
    }
}

private struct RippleEffect: ViewModifier, Animatable {
    var origin: CGPoint
    var elapsed: Double
    var animatableData: Double {
        get { elapsed }
        set { elapsed = newValue }
    }

    func body(content: Content) -> some View {
        let shader = ShaderLibrary.ripple(
            .float2(origin), .float(elapsed),
            .float(6), .float(14), .float(5.5), .float(900))
        content.visualEffect { view, _ in
            view.layerEffect(shader, maxSampleOffset: CGSize(width: 6, height: 6), isEnabled: elapsed > 0 && elapsed < 1.1)
        }
    }
}

/**
 * Buttons give a little under a finger, spring back like a water surface, and send a ripple out across
 * themselves. Everything is driven by the button's own pressed state: no extra gesture is attached, so
 * nothing can compete with the button for the tap.
 */
struct WaterButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        WaterButtonBody(configuration: configuration)
    }
}

private struct WaterButtonBody: View {
    let configuration: ButtonStyleConfiguration
    @State private var ripples = 0
    @State private var size: CGSize = .zero

    var body: some View {
        configuration.label
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .modifier(RippleModifier(trigger: ripples, origin: CGPoint(x: size.width / 2, y: size.height / 2)))
            .scaleEffect(configuration.isPressed ? 0.965 : 1)
            .brightness(configuration.isPressed ? -0.03 : 0)
            .animation(configuration.isPressed ? Motion.press : Motion.splash, value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, pressed in if pressed { ripples += 1 } }
    }
}

// ---------- the liquid progress bar ----------

/** A capsule filled with liquid to `fraction`. The level flows to new values and sloshes as it lands. */
struct LiquidBar: View {
    var fraction: Double
    var fill: Color = Palette.signal
    var height: CGFloat = 10
    /** Where the level starts on first appearance, so a fresh log can visibly pour in. */
    var from: Double? = nil

    @State private var shown: Double = 0
    @State private var changedAt = Date.distantPast
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60, paused: reduce)) { ctx in
            let since = ctx.date.timeIntervalSince(changedAt)
            LiquidFill(
                level: shown,
                time: ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3600),
                slosh: reduce ? 0 : max(0, 1 - since / 1.6),
                fill: fill)
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue("\(Int((fraction * 100).rounded())) percent")
        .onAppear {
            shown = from ?? fraction
            if let from, from != fraction { pour(to: fraction, delay: 0.35) }
        }
        .onChange(of: fraction) { _, new in pour(to: new, delay: 0) }
    }

    private func pour(to value: Double, delay: Double) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            changedAt = .now
            withAnimation(reduce ? nil : Motion.wave) { shown = value }
        }
    }
}

/** Animatable, so SwiftUI hands the shader every in-between level while the liquid flows. */
private struct LiquidFill: View, Animatable {
    var level: Double
    var time: Double
    var slosh: Double
    var fill: Color
    var animatableData: Double {
        get { level }
        set { level = newValue }
    }

    var body: some View {
        Capsule()
            .fill(.white)
            .visualEffect { [level, time, slosh, fill] view, proxy in
                view.colorEffect(ShaderLibrary.liquidBar(
                    .float2(proxy.size), .float(level), .float(time), .float(slosh),
                    .color(fill), .color(Palette.track)))
            }
    }
}

// ---------- water rising in a circle ----------

/** A circle that fills with water from the bottom. Animate `level` and the water pours in. */
struct WaterCircle<Overlay: View>: View {
    var level: Double
    var size: CGFloat
    @ViewBuilder var overlay: Overlay
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60, paused: reduce)) { ctx in
            WaterCircleFill(level: level, time: ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3600))
        }
        .frame(width: size, height: size)
        .overlay { overlay }
    }
}

private struct WaterCircleFill: View, Animatable {
    var level: Double
    var time: Double
    var animatableData: Double {
        get { level }
        set { level = newValue }
    }

    var body: some View {
        Circle()
            .fill(.white)
            .visualEffect { [level, time] view, proxy in
                view.colorEffect(ShaderLibrary.waterLevel(
                    .float2(proxy.size), .float(level), .float(time),
                    .color(Palette.signal), .color(Palette.signalTint)))
            }
    }
}

// ---------- the backdrop ----------

/** The page color with faint pool light wandering across its top. */
struct WaterBackdrop: View {
    var tint: Color = Palette.accent
    var strength: Double = 0.16
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduce)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3600)
            Rectangle()
                .fill(Palette.page)
                .visualEffect { [tint, strength, scheme] view, proxy in
                    view.colorEffect(ShaderLibrary.caustics(
                        .float2(proxy.size), .float(t), .color(tint), .float(scheme == .dark ? min(0.6, strength * 2.6) : strength)))
                }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

// ---------- settling on arrival ----------

private struct SettleModifier: ViewModifier {
    var index: Int
    /** Off for anything the shader layer cannot draw: scroll views and RealityKit come out blank or as a warning sign. */
    var ripples = true
    @State private var shown = false
    @State private var settling = false
    @State private var start = Date.now
    @Environment(\.accessibilityReduceMotion) private var reduce

    func body(content: Content) -> some View {
        // One structure for the whole life of the view. Swapping between a plain branch and a rippling
        // branch would make SwiftUI rebuild everything inside each time, and every entrance animation in
        // there would play twice. The timeline is simply paused when nothing is moving.
        Group {
            if ripples {
                TimelineView(.animation(minimumInterval: 1 / 60, paused: !settling || reduce)) { timeline in
                    let t = timeline.date.timeIntervalSince(start)
                    content.visualEffect { [settling, reduce] view, proxy in
                        view.distortionEffect(
                            ShaderLibrary.settle(.float2(proxy.size), .float(t), .float(2.2)),
                            maxSampleOffset: CGSize(width: 3, height: 2),
                            isEnabled: settling && !reduce)
                    }
                }
            } else {
                content
            }
        }
        .opacity(shown ? 1 : 0)
        .blur(radius: shown || reduce ? 0 : 6)
        .scaleEffect(shown || reduce ? 1 : 0.96, anchor: .top)
        .offset(y: shown || reduce ? 0 : 14)
        .onAppear {
            guard !shown else { return }
            let delay = Double(min(index, 8)) * 0.055
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                start = .now
                settling = true
                withAnimation(reduce ? .easeOut(duration: 0.2) : Motion.wave) { shown = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { settling = false }
            }
        }
    }
}

extension View {
    /** Flows in like a drop landing: fades up out of a blur, then the surface settles. Staggered by `index`. */
    func settles(_ index: Int = 0) -> some View { modifier(SettleModifier(index: index)) }

    /** The same entrance without the ripple, for scroll views and RealityKit, which the ripple's layer cannot draw. */
    func flowsIn(_ index: Int = 0) -> some View { modifier(SettleModifier(index: index, ripples: false)) }
}

extension AnyTransition {
    /** Content poured in or drained out. */
    static var liquid: AnyTransition {
        .modifier(
            active: LiquidTransition(progress: 0),
            identity: LiquidTransition(progress: 1))
    }
}

private struct LiquidTransition: ViewModifier {
    var progress: Double
    func body(content: Content) -> some View {
        content
            .opacity(progress)
            .blur(radius: (1 - progress) * 8)
            .scaleEffect(0.94 + 0.06 * progress)
    }
}
