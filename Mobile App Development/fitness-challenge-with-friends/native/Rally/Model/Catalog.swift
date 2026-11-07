import Foundation

// Port of shared/catalog.ts: the challenge types and the words and numbers built from them.

struct TypeInfo {
    let label: String
    let one: String
    let many: String
    let numeric: Bool
    let defaultPer: String
    let defaultTarget: Double
    let defaultName: String
    let noun: String
    /** The SF Symbol for this kind of activity. */
    let symbol: String
}

nonisolated enum Catalog {
    static let types: [String: TypeInfo] = [
        "gym": TypeInfo(label: "Gym sessions", one: "gym session", many: "gym sessions", numeric: false, defaultPer: "week", defaultTarget: 3, defaultName: "Gym challenge", noun: "gym", symbol: "dumbbell.fill"),
        "walk": TypeInfo(label: "Walks", one: "walk", many: "walks", numeric: false, defaultPer: "week", defaultTarget: 3, defaultName: "Walking challenge", noun: "walking", symbol: "figure.walk"),
        "run": TypeInfo(label: "Runs", one: "run", many: "runs", numeric: false, defaultPer: "week", defaultTarget: 2, defaultName: "Running challenge", noun: "running", symbol: "figure.run"),
        "bike": TypeInfo(label: "Bike rides", one: "bike ride", many: "bike rides", numeric: false, defaultPer: "week", defaultTarget: 2, defaultName: "Bike challenge", noun: "bike", symbol: "figure.outdoor.cycle"),
        "class": TypeInfo(label: "Classes", one: "class", many: "classes", numeric: false, defaultPer: "week", defaultTarget: 2, defaultName: "Class challenge", noun: "class", symbol: "figure.yoga"),
        "steps": TypeInfo(label: "Steps", one: "step", many: "steps", numeric: true, defaultPer: "day", defaultTarget: 8000, defaultName: "Steps challenge", noun: "steps", symbol: "shoeprints.fill"),
        "miles": TypeInfo(label: "Miles", one: "mile", many: "miles", numeric: true, defaultPer: "week", defaultTarget: 10, defaultName: "Miles challenge", noun: "miles", symbol: "point.topleft.down.to.point.bottomright.curvepath.fill"),
        "minutes": TypeInfo(label: "Active minutes", one: "minute", many: "minutes", numeric: true, defaultPer: "week", defaultTarget: 150, defaultName: "Minutes challenge", noun: "minutes", symbol: "timer"),
        "custom": TypeInfo(label: "Your own", one: "session", many: "sessions", numeric: false, defaultPer: "week", defaultTarget: 3, defaultName: "Challenge", noun: "", symbol: "star.fill"),
    ]

    static func info(_ type: String) -> TypeInfo { types[type] ?? types["custom"]! }

    // ---------- pictures ----------
    // One emoji per kind of thing, so a card can be recognised before it is read.

    static let emoji: [String: String] = [
        "gym": "🏋️", "walk": "🚶", "run": "🏃", "bike": "🚴", "class": "🧘", "steps": "👟", "miles": "🛣️", "minutes": "⏱️", "custom": "⭐️",
        "sport": "⚽️", "other": "✨",
    ]

    static func emoji(_ key: String) -> String { emoji[key] ?? "⭐️" }

    /** The type behind a line like "4 runs a week", for cards that arrive without one. */
    static func guessType(from text: String) -> String {
        let t = text.lowercased()
        for (word, type) in [("gym", "gym"), ("walk", "walk"), ("run", "run"), ("bike", "bike"), ("class", "class"), ("step", "steps"), ("mile", "miles"), ("minute", "minutes")] where t.contains(word) {
            return type
        }
        return "custom"
    }

    static let bandEmoji = ["starting": "🌱", "active": "🙂", "very": "⚡️"]

    static let trackTypes = ["gym", "walk", "run", "bike", "class", "steps", "miles"]
    /** What a challenge can be about: everything you can track, plus minutes of any workout. */
    static let challengeTypes = trackTypes + ["minutes"]

    struct Band { let key: String; let label: String; let hint: String }
    static let bands = [
        Band(key: "starting", label: "Just getting started", hint: "A walk here and there"),
        Band(key: "active", label: "Active most weeks", hint: "You move a few times a week"),
        Band(key: "very", label: "Very active", hint: "You train most days"),
    ]

    static func fairPlay(_ type: String, house: Bool) -> Bool { !house && info(type).numeric }

    struct Activity { let key: String; let label: String; let symbol: String; let fits: [String] }
    static let activities = [
        Activity(key: "gym", label: "Gym", symbol: "dumbbell.fill", fits: ["gym", "minutes", "custom"]),
        Activity(key: "walk", label: "Walk", symbol: "figure.walk", fits: ["walk", "steps", "miles", "minutes"]),
        Activity(key: "run", label: "Run", symbol: "figure.run", fits: ["run", "steps", "miles", "minutes"]),
        Activity(key: "bike", label: "Bike", symbol: "figure.outdoor.cycle", fits: ["bike", "miles", "minutes"]),
        Activity(key: "class", label: "Class", symbol: "figure.yoga", fits: ["class", "minutes", "custom"]),
        Activity(key: "sport", label: "Sport", symbol: "sportscourt.fill", fits: ["steps", "miles", "minutes", "custom"]),
        Activity(key: "other", label: "Other", symbol: "sparkles", fits: ["custom", "steps", "miles", "minutes"]),
    ]

    static let lengths: [(days: Int, label: String)] = [(7, "1 week"), (14, "2 weeks"), (28, "1 month")]

    static func range(_ from: Double, _ to: Double, _ step: Double = 1) -> [Double] {
        var out: [Double] = []
        var v = from
        while v <= to + 1e-9 {
            out.append((v * 10).rounded() / 10)
            v += step
        }
        return out
    }

    /** Session challenges allow one log a day, so a weekly target tops out at 7 and a daily one is 1. */
    static func targetOptions(_ type: String, per: String) -> [Double] {
        if type == "steps" { return range(2000, 20000, 500) }
        if type == "miles" { return range(1, 50) }
        if type == "minutes" { return range(10, 600, 10) }
        return per == "day" ? [1] : range(1, 7)
    }

    static func logOptions(_ type: String) -> [Double] {
        if type == "minutes" { return range(5, 300, 5) }
        return type == "steps" ? range(500, 30000, 500) : range(0.5, 30, 0.5)
    }

    static func fmt(_ n: Double) -> String {
        let rounded = (n * 10).rounded() / 10
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 1
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: rounded)) ?? "\(rounded)"
    }

    static func unit(_ type: String, _ n: Double) -> String { n == 1 ? info(type).one : info(type).many }

    static func weeksText(_ days: Int) -> String { days == 7 ? "1 week" : "\(Int((Double(days) / 7).rounded())) weeks" }

    static func targetShort(type: String, target: Double, per: String) -> String {
        if per == "total" { return "\(fmt(target)) \(unit(type, target)) total" }
        return "\(fmt(target)) \(unit(type, target)) a \(per)"
    }

    static func targetText(type: String, target: Double, per: String, lengthDays: Int) -> String {
        "\(targetShort(type: type, target: target, per: per)) \(per == "total" ? "in" : "for") \(weeksText(lengthDays))."
    }

    // ---------- dates ----------
    // Plain YYYY-MM-DD strings in the person's own calendar. The app sends its own "today" with every
    // request so the server never guesses a time zone.

    static func localDate(_ date: Date = .now) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"]
    private static let weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    private static func parts(_ d: String) -> (Int, Int, Int)? {
        let p = d.prefix(10).split(separator: "-").compactMap { Int($0) }
        return p.count == 3 ? (p[0], p[1], p[2]) : nil
    }

    static func shortDate(_ d: String) -> String {
        guard let (_, m, day) = parts(d) else { return d }
        return "\(months[m - 1]) \(day)"
    }

    static func longDate(_ d: String) -> String {
        guard let (y, m, day) = parts(d) else { return d }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let date = cal.date(from: DateComponents(year: y, month: m, day: day))!
        return "\(weekdays[cal.component(.weekday, from: date) - 1]), \(shortDate(d))"
    }

    static let times: [String] = (0..<48).map { String(format: "%02d:%@", $0 / 2, $0 % 2 == 1 ? "30" : "00") }

    static func timeLabel(_ hhmm: String) -> String {
        let h = Int(hhmm.prefix(2)) ?? 0
        let suffix = h < 12 ? "am" : "pm"
        return "\(h % 12 == 0 ? 12 : h % 12):\(hhmm.suffix(2)) \(suffix)"
    }
}
