import SwiftUI
import UIKit

// The building blocks every screen is made of. Type is San Francisco at Dynamic Type sizes; headings
// use the rounded design, like Apple's Fitness app.

extension Font {
    static let display = Font.system(.largeTitle, design: .rounded).weight(.bold)
    static let heading = Font.system(.title2, design: .rounded).weight(.semibold)
    static let label = Font.subheadline.weight(.medium)
}

enum Haptic {
    static func tap(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) { UIImpactFeedbackGenerator(style: style).impactOccurred() }
    static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
}

// ---------- buttons ----------

/** The one red button on a screen. */
struct PrimaryButton: View {
    var title: String
    var symbol: String? = nil
    var busy = false
    var disabled = false
    var action: () -> Void
    @Environment(\.colorSchemeContrast) private var contrast

    var body: some View {
        Button {
            Haptic.tap(.medium)
            action()
        } label: {
            ZStack {
                if busy {
                    BusyDots().foregroundStyle(.white)
                } else {
                    Label {
                        Text(title)
                    } icon: {
                        if let symbol { Image(systemName: symbol) }
                    }
                    .labelStyle(.titleAndIcon)
                    .font(.headline)
                    .foregroundStyle(disabled ? Palette.stone : .white)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(disabled ? Palette.track : Palette.signal, in: .capsule)
            .contentShape(.capsule)
        }
        .buttonStyle(WaterButtonStyle())
        .disabled(disabled || busy)
        .animation(Motion.fluid, value: disabled)
        .animation(Motion.fluid, value: busy)
    }
}

/** Everything that is not the main action: a Liquid Glass capsule. */
struct SecondaryButton: View {
    var title: String
    var symbol: String? = nil
    var busy = false
    var disabled = false
    var compact = false
    var action: () -> Void

    var body: some View {
        Button {
            Haptic.tap()
            action()
        } label: {
            ZStack {
                if busy {
                    BusyDots()
                } else {
                    HStack(spacing: 6) {
                        if let symbol { Image(systemName: symbol) }
                        Text(title)
                    }
                    .font(.headline)
                }
            }
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: compact ? nil : .infinity, minHeight: compact ? 44 : 54)
            .padding(.horizontal, compact ? 18 : 0)
            .glassEffect(.regular.interactive(), in: .capsule)
            .overlay(Capsule().strokeBorder(Palette.ink.opacity(0.18), lineWidth: 1))
            .contentShape(.capsule)
        }
        .buttonStyle(WaterButtonStyle())
        .disabled(disabled || busy)
        .opacity(disabled ? 0.5 : 1)
    }
}

/** Working on it: three dots that ripple, in place of a button's label. */
struct BusyDots: View {
    var body: some View {
        Image(systemName: "ellipsis")
            .font(.title2.weight(.bold))
            .symbolEffect(.variableColor.iterative.dimInactiveLayers, options: .repeating)
            .accessibilityLabel("Working")
    }
}

struct TextButton: View {
    var title: String
    var action: () -> Void
    var body: some View {
        Button(title) {
            Haptic.tap()
            action()
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(Palette.stone)
        .frame(maxWidth: .infinity, minHeight: 44)
    }
}

// ---------- surfaces ----------

struct Card<Content: View>: View {
    var tint = false
    var padding: CGFloat = Metrics.card
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(tint ? Palette.signalTint : Palette.card, in: .rect(cornerRadius: Metrics.radius))
    }
}

struct ErrorLine: View {
    var text: String?
    var body: some View {
        if let text, !text.isEmpty {
            Label(text, systemImage: "exclamationmark.circle.fill")
                .font(.subheadline)
                .foregroundStyle(Palette.accent)
                .transition(.liquid)
        }
    }
}

// ---------- pictures ----------

/** An emoji on a soft tile: the picture at the front of a card. Decorative, so VoiceOver skips it. */
struct EmojiBadge: View {
    var emoji: String
    var size: CGFloat = 46
    var tint: Color = Palette.signalTint

    var body: some View {
        Text(emoji)
            .font(.system(size: size * 0.56))
            .frame(width: size, height: size)
            .background(tint, in: .rect(cornerRadius: size * 0.3))
            .accessibilityHidden(true)
    }
}

/** A large SF Symbol in Apple's layered colors on a soft disc, for empty states and openers. */
struct SymbolArt: View {
    var symbol: String
    var size: CGFloat = 96
    @State private var landed = false

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .semibold))
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(Palette.accent)
            .symbolEffect(.bounce, value: landed)
            .frame(width: size, height: size)
            .background(
                LinearGradient(colors: [Palette.signalTint, Palette.signalTint.opacity(0.35)], startPoint: .top, endPoint: .bottom),
                in: .circle)
            .onAppear { landed = true }
            .accessibilityHidden(true)
    }
}

/**
 * A challenge medal: a ribbon and a disc with the challenge's emoji struck into it. Gold for winning,
 * Rally red for reaching your goal, and a dull blank while it is still locked.
 */
struct MedalView: View {
    enum Kind { case gold, goal, locked }
    var kind: Kind
    var emoji: String
    var size: CGFloat = 72

    static func kind(_ medal: String?) -> Kind? {
        switch medal {
        case "gold": .gold
        case "goal": .goal
        default: nil
        }
    }

    private var metal: [Color] {
        switch kind {
        case .gold: [Color(red: 1.0, green: 0.87, blue: 0.42), Color(red: 0.86, green: 0.60, blue: 0.13)]
        case .goal: [Color(red: 0.98, green: 0.45, blue: 0.40), Color(red: 0.72, green: 0.13, blue: 0.10)]
        case .locked: [Color(uiColor: .systemGray3), Color(uiColor: .systemGray4)]
        }
    }

    var body: some View {
        VStack(spacing: -size * 0.16) {
            // The ribbon: two tails meeting behind the disc.
            HStack(spacing: size * 0.04) {
                ForEach(0..<2, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(kind == .locked ? Color(uiColor: .systemGray4) : i == 0 ? Palette.signal : Palette.accent)
                        .frame(width: size * 0.2, height: size * 0.42)
                        .rotationEffect(.degrees(i == 0 ? 14 : -14), anchor: .bottom)
                }
            }
            Circle()
                .fill(LinearGradient(colors: metal, startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(Circle().strokeBorder(.white.opacity(kind == .locked ? 0.15 : 0.45), lineWidth: size * 0.045).padding(size * 0.06))
                .overlay {
                    if kind == .locked {
                        Image(systemName: "lock.fill").font(.system(size: size * 0.3, weight: .semibold)).foregroundStyle(Color(uiColor: .systemGray))
                    } else {
                        Text(emoji).font(.system(size: size * 0.42))
                    }
                }
                .frame(width: size, height: size)
                .shadow(color: metal[1].opacity(kind == .locked ? 0 : 0.45), radius: size * 0.12, y: size * 0.05)
        }
        .accessibilityHidden(true)
    }
}

/**
 * A photo across the top of a card or screen, washed toward Rally's colors so it sits in the design
 * rather than on top of it: a faint red cast, and a fade into whatever is underneath. Photos live in
 * `Photos/` as `photo-<name>.jpg`. Where there is no photo for a name, a soft tile with the emoji stands in.
 */
struct PhotoBanner: View {
    var name: String
    var emoji: String
    var height: CGFloat = 150
    var fadeTo: Color = Palette.card

    static func image(_ name: String) -> UIImage? { UIImage(named: "photo-\(name).jpg") }
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Group {
            if let photo = Self.image(name) {
                // A duotone in Rally's colors: the photo is reduced to light and shade, then takes its hue
                // from Rally red, so every photo belongs to the same family whatever was in it.
                Color.clear
                    .overlay { Image(uiImage: photo).resizable().scaledToFill().saturation(0).contrast(1.08) }
                    // Shadows lift toward deep Rally red, highlights settle on the app's pale pink.
                    .overlay { Color(red: 0.55, green: 0.10, blue: 0.08).blendMode(.screen).opacity(0.55) }
                    .overlay { Color(red: 0.98, green: 0.89, blue: 0.88).blendMode(.multiply) }
                    .overlay { Color.black.opacity(scheme == .dark ? 0.28 : 0) }
                    .compositingGroup()
                    .overlay { LinearGradient(colors: [.clear, .clear, fadeTo.opacity(0.92)], startPoint: .top, endPoint: .bottom) }
            } else {
                LinearGradient(colors: [Palette.signalTint, Palette.signalTint.opacity(0.4)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .overlay { Text(emoji).font(.system(size: height * 0.42)) }
            }
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .clipped()
        .accessibilityHidden(true)
    }
}

/** A friendly empty spot: a picture, a line, and nothing to explain. */
struct EmptyNote: View {
    var symbol: String
    var text: String

    var body: some View {
        Card {
            HStack(spacing: Metrics.gap) {
                SymbolArt(symbol: symbol, size: 56)
                Text(text)
            }
        }
    }
}

// ---------- people ----------

struct AvatarView: View {
    var person: Person
    var size: CGFloat = 48
    var dot = false

    var body: some View {
        Circle()
            .fill(AvatarTone.fill(person.avatar))
            .frame(width: size, height: size)
            .overlay(Circle().strokeBorder(Palette.line, lineWidth: 0.5))
            .overlay {
                Text(String(person.name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
                    .font(.system(size: size * 0.42, weight: .semibold, design: .rounded))
                    .foregroundStyle(AvatarTone.text(person.avatar))
            }
            // Winners get a gold ring for as long as they hold the reward.
            .overlay {
                if person.flair?.kind == "reward" {
                    Circle().strokeBorder(
                        LinearGradient(colors: [Color(red: 1, green: 0.87, blue: 0.42), Color(red: 0.86, green: 0.60, blue: 0.13)], startPoint: .topLeading, endPoint: .bottomTrailing),
                        lineWidth: max(2, size * 0.06))
                }
            }
            // The badge itself, worn on the shoulder. Too small to read on the tiniest avatars.
            .overlay(alignment: .topTrailing) {
                if let flair = person.flair, size >= 34 {
                    Text(flair.emoji)
                        .font(.system(size: size * 0.4))
                        .frame(width: size * 0.52, height: size * 0.52)
                        .background(Palette.raised, in: .circle)
                        .overlay(Circle().strokeBorder(Palette.line, lineWidth: 0.5))
                        .offset(x: size * 0.16, y: -size * 0.14)
                        .accessibilityLabel(flair.kind == "reward" ? "Wearing a winner's badge" : "Wearing a forfeit badge")
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if dot {
                    Circle()
                        .fill(Palette.accent)
                        .frame(width: max(10, size * 0.28), height: max(10, size * 0.28))
                        .overlay(Circle().stroke(Palette.page, lineWidth: 2))
                        .accessibilityLabel("Logged today")
                        .transition(.scale.combined(with: .opacity))
                }
            }
    }
}

struct AvatarStack: View {
    var people: [Person]
    var total: Int? = nil
    var size: CGFloat = 28

    var body: some View {
        HStack(spacing: -8) {
            ForEach(people) { p in
                AvatarView(person: p, size: size)
                    .overlay(Circle().stroke(Palette.card, lineWidth: 2))
            }
            let extra = (total ?? people.count) - people.count
            if extra > 0 {
                Text("+\(extra)").font(.footnote).foregroundStyle(Palette.stone).padding(.leading, 14)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(total ?? people.count) people")
    }
}

struct CheckBadge: View {
    var size: CGFloat = 28
    var body: some View {
        Image(systemName: "checkmark.circle.fill")
            .font(.system(size: size))
            .symbolRenderingMode(.palette)
            .foregroundStyle(.white, Palette.done)
            .accessibilityLabel("Done")
    }
}

// ---------- choosing ----------

/** Lays chips out left to right and wraps them onto new lines, like words in a sentence. */
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, widest: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.init(width: width, height: nil))
            if x > 0, x + size.width > width {
                y += row + spacing
                x = 0
                row = 0
            }
            x += size.width + spacing
            row = max(row, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.init(width: bounds.width, height: nil))
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += row + spacing
                x = bounds.minX
                row = 0
            }
            s.place(at: CGPoint(x: x, y: y), proposal: .init(size))
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}

struct ChipOption: Identifiable, Hashable {
    var id: String
    var label: String
    var symbol: String? = nil
    var emoji: String? = nil
    var disabled = false
}

struct Chip: View {
    var option: ChipOption
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button {
            Haptic.select()
            action()
        } label: {
            HStack(spacing: 6) {
                if let emoji = option.emoji { Text(emoji).scaleEffect(selected ? 1.2 : 1).accessibilityHidden(true) }
                if let symbol = option.symbol { Image(systemName: symbol).symbolEffect(.bounce, value: selected) }
                Text(option.label).multilineTextAlignment(.leading)
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(option.disabled ? Palette.faint : selected ? Palette.ink : Palette.ink)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(selected ? Palette.signalTint : Palette.card, in: .capsule)
            .overlay(Capsule().strokeBorder(selected ? Palette.accent : Palette.line, lineWidth: selected ? 1.5 : 0.5))
            .contentShape(.capsule)
        }
        .buttonStyle(WaterButtonStyle())
        .disabled(option.disabled)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .animation(Motion.splash, value: selected)
    }
}

/** Pick one. Tapping the picked one again calls `onChange` with the same key; screens decide what that means. */
struct ChipPicker: View {
    var options: [ChipOption]
    var selection: String?
    var onChange: (String) -> Void

    var body: some View {
        FlowLayout {
            ForEach(options) { o in
                Chip(option: o, selected: o.id == selection) { onChange(o.id) }
            }
        }
    }
}

/** Pick several, up to `max`. */
struct MultiChipPicker: View {
    var options: [ChipOption]
    @Binding var selection: [String]
    var max: Int = .max

    var body: some View {
        FlowLayout {
            ForEach(options) { o in
                let on = selection.contains(o.id)
                Chip(option: o, selected: on) {
                    if on { selection.removeAll { $0 == o.id } } else if selection.count < max { selection.append(o.id) }
                }
            }
        }
    }
}

/** A phone-style keypad for a 4 digit PIN. Tap only; no keyboard. */
struct PinPad: View {
    @Binding var value: String
    var length = 4

    private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete.left"]

    var body: some View {
        VStack(spacing: 24) {
            HStack(spacing: 16) {
                ForEach(0..<length, id: \.self) { i in
                    Circle()
                        .fill(i < value.count ? Palette.ink : .clear)
                        .overlay(Circle().strokeBorder(Palette.ink, lineWidth: 1.5))
                        .frame(width: 14, height: 14)
                        .scaleEffect(i < value.count ? 1.15 : 1)
                        .animation(Motion.splash, value: value.count)
                }
            }
            .accessibilityElement()
            .accessibilityLabel("\(value.count) of \(length) digits entered")
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(84), spacing: 18), count: 3), spacing: 14) {
                ForEach(keys, id: \.self) { k in
                    if k.isEmpty {
                        Color.clear.frame(height: 64)
                    } else {
                        Button {
                            Haptic.select()
                            if k == "delete.left" {
                                if !value.isEmpty { value.removeLast() }
                            } else if value.count < length {
                                value.append(k)
                            }
                        } label: {
                            Group {
                                if k == "delete.left" { Image(systemName: k).font(.title2) } else { Text(k).font(.system(.title, design: .rounded).weight(.medium)) }
                            }
                            .foregroundStyle(Palette.ink)
                            .frame(width: 72, height: 64)
                            .background(k == "delete.left" ? .clear : Palette.card, in: .circle)
                            .contentShape(.circle)
                        }
                        .buttonStyle(WaterButtonStyle())
                        .accessibilityLabel(k == "delete.left" ? "Delete" : k)
                    }
                }
            }
        }
    }
}

/** A native wheel, for numbers and times. */
struct WheelPicker<V: Hashable>: View {
    var label: String
    var values: [V]
    @Binding var value: V
    var format: (V) -> String

    var body: some View {
        Picker(label, selection: $value) {
            ForEach(values, id: \.self) { v in Text(format(v)).tag(v) }
        }
        .pickerStyle(.wheel)
        .frame(height: 150)
        .frame(maxWidth: .infinity)
        .background(Palette.card, in: .rect(cornerRadius: Metrics.radius))
        .onChange(of: value) { Haptic.select() }
    }
}

struct RallyField: View {
    var placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var capitalization: TextInputAutocapitalization = .sentences
    var maxLength = 80
    var onSubmit: () -> Void = {}
    @FocusState private var focused: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .keyboardType(keyboard)
            .textInputAutocapitalization(capitalization)
            .focused($focused)
            .submitLabel(.done)
            .onSubmit(onSubmit)
            .padding(.horizontal, 16)
            .frame(minHeight: 54)
            .background(Palette.card, in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(focused ? Palette.accent : Palette.line, lineWidth: focused ? 1.5 : 0.5))
            .animation(Motion.fluid, value: focused)
            .onChange(of: text) { _, v in if v.count > maxLength { text = String(v.prefix(maxLength)) } }
    }
}

// ---------- loading ----------

/** A screen's shape, drawn while its data is on the way, with water light running across it. */
struct Skeleton: View {
    var heights: [CGFloat]
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.gap) {
            ForEach(Array(heights.enumerated()), id: \.offset) { i, h in
                RoundedRectangle(cornerRadius: i == 0 ? 10 : Metrics.radius)
                    .fill(Palette.track)
                    .frame(maxWidth: i == 0 ? 240 : .infinity)
                    .frame(height: h)
            }
        }
        .overlay {
            GeometryReader { g in
                LinearGradient(colors: [.clear, .white.opacity(0.35), .clear], startPoint: .leading, endPoint: .trailing)
                    .frame(width: g.size.width * 0.6)
                    .offset(x: phase * g.size.width)
                    .blendMode(.plusLighter)
            }
            .mask {
                VStack(alignment: .leading, spacing: Metrics.gap) {
                    ForEach(Array(heights.enumerated()), id: \.offset) { i, h in
                        RoundedRectangle(cornerRadius: i == 0 ? 10 : Metrics.radius).frame(maxWidth: i == 0 ? 240 : .infinity).frame(height: h)
                    }
                }
            }
        }
        .onAppear {
            guard !reduce else { return }
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: false)) { phase = 1.4 }
        }
        .accessibilityElement()
        .accessibilityLabel("Loading")
    }
}

/** Loading, or a failed load with a way to try again. */
struct Waiting: View {
    var error: String?
    var heights: [CGFloat] = [34, 110, 110]
    var retry: () -> Void

    var body: some View {
        if let error {
            Card {
                Text(error)
                SecondaryButton(title: "Try again", symbol: "arrow.clockwise", action: retry)
            }
            .transition(.liquid)
        } else {
            Skeleton(heights: heights)
        }
    }
}

// ---------- a scrolling page ----------

/** A screen: the water backdrop, a scrolling column, and an optional footer pinned above the bottom. */
struct Page<Content: View, Footer: View>: View {
    var backdrop = true
    @ViewBuilder var content: Content
    @ViewBuilder var footer: Footer

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.gap * 2) { content }
                .padding(.horizontal, Metrics.screen)
                .padding(.top, 8)
                .padding(.bottom, Metrics.screen)
        }
        // Debug only: -RallyPageBottom YES opens every page scrolled to its end, -RallyPageMid YES halfway.
        .defaultScrollAnchor(DebugDemo.flag("RallyPageBottom") ? .bottom : DebugDemo.flag("RallyPageMid") ? .center : .top)
        .scrollDismissesKeyboard(.interactively)
        .background { if backdrop { WaterBackdrop() } else { Palette.page.ignoresSafeArea() } }
        // A safe area bar gives the iOS 26 scroll edge effect: content softens as it passes under the buttons.
        .safeAreaBar(edge: .bottom) {
            VStack(spacing: Metrics.gap) { footer }
                .padding(.horizontal, Metrics.screen)
                .padding(.top, Metrics.gap)
                .padding(.bottom, 8)
        }
    }
}

extension Page where Footer == EmptyView {
    init(backdrop: Bool = true, @ViewBuilder content: () -> Content) {
        self.init(backdrop: backdrop, content: content, footer: { EmptyView() })
    }
}
