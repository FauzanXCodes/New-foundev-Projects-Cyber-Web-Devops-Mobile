import SwiftUI
import UIKit

// Colors come from UIKit's semantic system colors, so Dark Mode and Increase Contrast are handled by
// the system. Rally's red is the one color of its own: an accent, with its own light, dark and
// Increase Contrast variants so it keeps its contrast on every background.

extension UIColor {
    nonisolated static func rally(light: UInt32, dark: UInt32, hcLight: UInt32, hcDark: UInt32) -> UIColor {
        UIColor { t in
            let high = t.accessibilityContrast == .high
            let hex = t.userInterfaceStyle == .dark ? (high ? hcDark : dark) : (high ? hcLight : light)
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        }
    }
}

nonisolated enum Palette {
    /** Fills that carry a white label, such as the primary button. 4.97:1 with white. */
    static let signal = Color(uiColor: .rally(light: 0xD62B23, dark: 0xD62B23, hcLight: 0xB3211A, hcDark: 0xB3211A))
    /** Red for icons and graphics drawn straight onto a background. Brighter in dark, for 3:1 or more. */
    static let accent = Color(uiColor: .rally(light: 0xD62B23, dark: 0xF0564B, hcLight: 0xB3211A, hcDark: 0xFF7A70))
    static let signalTint = Color(uiColor: .rally(light: 0xFBE4E2, dark: 0x3A1F1D, hcLight: 0xF6CFCB, hcDark: 0x4A2320))

    // Everything else is Apple's.
    static let page = Color(uiColor: .systemGroupedBackground)
    static let raised = Color(uiColor: .secondarySystemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let inset = Color(uiColor: .tertiarySystemGroupedBackground)
    static let ink = Color(uiColor: .label)
    static let stone = Color(uiColor: .secondaryLabel)
    static let faint = Color(uiColor: .tertiaryLabel)
    static let line = Color(uiColor: .separator)
    static let track = Color(uiColor: .systemFill)
    static let water = Color(uiColor: .systemTeal)
    /** Done. Apple's system green, the one color besides red that means something. */
    static let done = Color(uiColor: .systemGreen)
}

enum Metrics {
    static let screen: CGFloat = 20
    static let gap: CGFloat = 12
    static let card: CGFloat = 20
    static let touch: CGFloat = 48
    static let radius: CGFloat = 24
}

/** Avatars stay neutral so red keeps its meaning. Shades of the system grays. */
enum AvatarTone {
    static let fills: [UIColor] = [.systemGray4, .label, .systemGray3, .systemGray, .systemGray5, .darkGray]
    static func fill(_ i: Int) -> Color { Color(uiColor: fills[abs(i) % fills.count]) }
    static func text(_ i: Int) -> Color {
        switch abs(i) % fills.count {
        case 1: Color(uiColor: .systemBackground)
        case 3, 5: .white
        default: Color(uiColor: .label)
        }
    }
}

// ---------- appearance ----------

/** The Dark Mode setting. "System" follows the phone; the other two pin the app. */
enum AppearanceChoice: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var label: String {
        switch self {
        case .system: "Match iPhone"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
    var symbol: String {
        switch self {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max.fill"
        case .dark: "moon.fill"
        }
    }
    var style: UIUserInterfaceStyle {
        switch self {
        case .system: .unspecified
        case .light: .light
        case .dark: .dark
        }
    }
}

enum Appearance {
    static let key = "appearance"
    /** What the app uses until someone picks for themselves in Settings. */
    static let fallback = AppearanceChoice.dark

    /** Applies the choice to every window, so sheets, alerts and the keyboard follow it too. */
    static func apply(_ choice: AppearanceChoice) {
        for scene in UIApplication.shared.connectedScenes {
            guard let windows = (scene as? UIWindowScene)?.windows else { continue }
            for w in windows {
                UIView.transition(with: w, duration: 0.45, options: [.transitionCrossDissolve, .allowAnimatedContent]) {
                    w.overrideUserInterfaceStyle = choice.style
                }
            }
        }
    }
}
