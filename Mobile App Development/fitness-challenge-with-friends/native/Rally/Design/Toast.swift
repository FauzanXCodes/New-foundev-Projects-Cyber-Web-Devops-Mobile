import Observation
import SwiftUI

// Banners: short notes that drop in at the top of the screen and leave on their own. One at a time,
// never blocking anything, and always dismissible with a swipe.

struct Toast: Identifiable, Equatable {
    let id = UUID()
    var emoji: String
    var title: String
    var detail: String? = nil
    /** A button on the banner, for notes you can act on. */
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil
    /** How long it stays, in seconds. Longer for ones with more to read. */
    var seconds: Double = 4

    static func == (a: Toast, b: Toast) -> Bool { a.id == b.id }
}

@Observable
final class Toaster {
    static let shared = Toaster()
    private(set) var current: Toast?
    @ObservationIgnored private var queue: [Toast] = []
    @ObservationIgnored private var timer: Task<Void, Never>?

    func show(_ toast: Toast) {
        if current == nil { present(toast) } else { queue.append(toast) }
    }

    /** A quick confirmation: "Saved", "Invite sent". */
    func confirm(_ emoji: String, _ title: String) { show(Toast(emoji: emoji, title: title, seconds: 2.4)) }

    func dismiss() {
        timer?.cancel()
        withAnimation(Motion.fluid) { current = nil }
        guard !queue.isEmpty else { return }
        let next = queue.removeFirst()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { self.present(next) }
    }

    private func present(_ toast: Toast) {
        withAnimation(Motion.splash) { current = toast }
        Haptic.tap()
        timer?.cancel()
        timer = Task {
            try? await Task.sleep(for: .seconds(toast.seconds))
            if !Task.isCancelled, current?.id == toast.id { dismiss() }
        }
    }
}

private struct ToastBanner: View {
    var toast: Toast
    @State private var drag: CGFloat = 0

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(toast.emoji).font(.title2).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title).font(.subheadline.weight(.semibold))
                if let detail = toast.detail {
                    Text(detail).font(.footnote).foregroundStyle(Palette.stone)
                }
            }
            .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            if let title = toast.actionTitle, let action = toast.action {
                Button(title) {
                    Haptic.tap(.medium)
                    action()
                    Toaster.shared.dismiss()
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(height: 34)
                .background(Palette.signal, in: .capsule)
            }
        }
        .foregroundStyle(Palette.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
        .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
        .padding(.horizontal, 12)
        .offset(y: min(0, drag))
        .gesture(
            DragGesture()
                .onChanged { drag = $0.translation.height }
                .onEnded { g in
                    if g.translation.height < -20 { Toaster.shared.dismiss() }
                    withAnimation(Motion.fluid) { drag = 0 }
                }
        )
        .onTapGesture { if toast.action == nil { Toaster.shared.dismiss() } }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}

/** Put once at the root: shows whatever the Toaster is holding. */
struct ToastHost: View {
    private var toaster: Toaster { Toaster.shared }

    var body: some View {
        VStack {
            if let toast = toaster.current {
                ToastBanner(toast: toast)
                    .id(toast.id)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onAppear { UIAccessibility.post(notification: .announcement, argument: [toast.title, toast.detail].compactMap { $0 }.joined(separator: ". ")) }
            }
            Spacer()
        }
        .padding(.top, 4)
        .animation(Motion.splash, value: toaster.current)
        .allowsHitTesting(toaster.current != nil)
    }
}
