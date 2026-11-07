import Foundation

// Port of shared/copy.ts: the words the app says.

nonisolated enum Copy {
    static let renameConsequence = "Gets a new last name from the winner for a week"

    static let consequenceSuggestions = [
        "Buys coffee",
        "Buys dinner",
        renameConsequence,
        "Posts an embarrassing video",
        "Wears the crew's pick for a day",
        "Does the winner's chores once",
        "Sings at the next hangout",
    ]

    /** A picture for a consequence: the suggestions each have their own, anything else gets a fitting guess. */
    static func consequenceEmoji(_ text: String) -> String {
        let t = text.lowercased()
        for (word, e) in [("gym bag", "🎒"), ("smoothie", "🥤"), ("dog", "🐕"), ("costume", "🦸"), ("water", "💧"), ("tire", "🛞"), ("streamer", "🎀"), ("front row", "🙋"), ("mat", "🧘"), ("stairs", "🪜"), ("route", "🗺️"), ("coffee", "☕️"), ("dinner", "🍽️"), ("lunch", "🥪"), ("last name", "📛"), ("video", "🎥"), ("wear", "👕"), ("chore", "🧹"), ("sing", "🎤"),
                          ("snack", "🍿"), ("movie", "🎬"), ("dance", "💃"), ("cook", "🍳"), ("pizza", "🍕"), ("drink", "🥤"), ("photo", "📸"), ("song", "🎵"), ("wash", "🧽"), ("car", "🚗")] where t.contains(word) {
            return e
        }
        return "🎯"
    }

    static let toneEmoji = ["friendly": "😊", "playful": "😜", "jab": "😤"]

    /** "Won" and the rest, for the list of past challenges. */
    static func resultEmoji(_ result: String) -> String {
        switch result {
        case "Won": "🏆"
        case "Finished": "✅"
        default: "👋"
        }
    }

    /** Real-life consequences that suit one kind of challenge. Offered first, ahead of the general ones. */
    static let themedConsequences: [String: [String]] = [
        "gym": ["Carries the winner's gym bag for a week", "Buys the post-workout smoothies"],
        "walk": ["Walks the winner's dog", "Carries the snacks on the next walk"],
        "run": ["Runs the next one in a costume", "Brings water for everyone's next run"],
        "bike": ["Pumps everyone's tires", "Rides with streamers on the handlebars"],
        "class": ["Takes the front row next class", "Carries the winner's mat to class"],
        "steps": ["Takes the stairs all week", "Walks to pick up everyone's coffee"],
        "miles": ["Plans the next route for everyone", "Wears the crew's pick on the next outing"],
    ]

    static func suggestions(for type: String) -> [String] { (themedConsequences[type] ?? []) + consequenceSuggestions }

    // Placeholder until the off limits list is decided. Money is the one firm rule.
    private static let offLimits = try! NSRegularExpression(
        pattern: #"\$|\bdollars?\b|\bbucks\b|\bcash\b|\bvenmo\b|\bzelle\b|\bpaypal\b|\bcash ?app\b|\bmoney\b"#,
        options: [.caseInsensitive])

    static func offLimitsReason(_ text: String) -> String? {
        let range = NSRange(text.startIndex..., in: text)
        return offLimits.firstMatch(in: text, range: range) != nil ? "Keep it light. No money." : nil
    }

    static func consequenceProblem(_ text: String) -> String? {
        text.trimmingCharacters(in: .whitespaces).isEmpty ? nil : offLimitsReason(text)
    }

    static let tones: [(key: String, label: String)] = [("friendly", "Friendly"), ("playful", "Playful"), ("jab", "Jab")]

    private static func lower(_ s: String) -> String { s.prefix(1).lowercased() + s.dropFirst() }
    private static func upper(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }

    static func inviteMessage(tone: String, type: String, target: Double, per: String, lengthDays: Int, name: String, consequence: String?, link: String) -> String {
        let short = Catalog.targetShort(type: type, target: target, per: per)
        let loser = consequence.map { "loser \(lower($0))" } ?? ""
        let noun = type == "custom" ? name : Catalog.info(type).noun
        let adjective = lengthDays == 7 ? "1 week" : "\(Int((Double(lengthDays) / 7).rounded())) week"
        let span = lengthDays == 7 ? "a week" : lengthDays == 14 ? "two weeks" : "a month"
        switch tone {
        case "playful":
            return "Bet you can't do \(short) for \(span). Prove me wrong.\(loser.isEmpty ? "" : " \(upper(loser)).") \(link)"
        case "jab":
            return "Get off the couch. \(upper(short)), \(Catalog.weeksText(lengthDays))\(loser.isEmpty ? "" : ", \(loser)"). You in or nah. \(link)"
        default:
            return "Starting a \(adjective) \(noun) challenge, \(short). Would love to do it with you.\(loser.isEmpty ? "" : " \(upper(loser)).") \(link)"
        }
    }

    static func crewInviteMessage(_ link: String) -> String {
        "I'm doing fitness challenges with friends and want you in my crew. \(link)"
    }

    static let bannerLines = [
        "Most people skip Fridays. Don't be most people.",
        "Your couch will still be there after your workout.",
        "Nobody ever said 'I wish I'd skipped that walk.'",
        "Somebody in your crew is hoping you skip today.",
        "Twenty minutes counts. So does a walk around the block.",
        "Today's workout is tomorrow's bragging rights.",
        "The hardest part is putting your shoes on. Go put your shoes on.",
        "Mondays are for fresh starts. So is every other day.",
        "Your crew can see who logged today. Just saying.",
        "Being on the hook is only fun for everyone else.",
        "A slow walk still beats a fast scroll.",
        "Rain is just a free cool down.",
        "Pack your gym bag tonight. Future you says thanks.",
        "It's not a streak until you do it twice.",
        "The best workout is the one you actually do.",
        "Somebody's buying coffee this week. Make sure it isn't you.",
        "Take the stairs. Nobody's timing you.",
        "Show up tired. It still counts.",
        "Your crew is counting on you. Mostly to lose.",
        "Small workouts add up faster than you think.",
        "Weekend plans? Put a walk in them.",
        "Missed yesterday? Today doesn't know that.",
        "Bring a friend. Misery loves company, and so does Pilates.",
        "Stretch first. Brag later.",
        "One more class than last week. That's the whole plan.",
        "A lunch break walk is a workout with a view.",
        "Consequences are funnier when they're someone else's.",
        "Don't let the group chat talk more than it walks.",
        "You don't have to love it. You just have to log it.",
        "Earn your dinner. Or at least don't buy everyone else's.",
    ]

    static func banner(for date: String = Catalog.localDate()) -> String {
        let p = date.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return bannerLines[0] }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let d = cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))!
        let dayOfYear = cal.ordinality(of: .day, in: .year, for: d) ?? 0
        return bannerLines[dayOfYear % bannerLines.count]
    }

    static func reminderLines(friend: String?) -> [String] {
        [
            "Time to move. Your crew is watching.",
            friend.map { "Log today before \($0) does." } ?? "Log today before your crew does.",
            "Twenty seconds to log. Go.",
            "Shoes on. Then log it.",
            "Nobody wants to be on the hook. Get moving.",
            "A quick walk counts. Go get one in.",
            "Your workout called. It wants to know where you are.",
        ]
    }

    /** A last name a winner may give: letters, spaces, hyphens, apostrophes and periods, up to 20. */
    static func cleanLastName(_ v: String) -> String? {
        let name = v.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard let first = name.first, first.isLetter, name.count <= 20 else { return nil }
        let allowed = name.allSatisfy { $0.isLetter || " '\u{2019}.-".contains($0) }
        return allowed ? name : nil
    }

    /** "Oct 2" from a timestamp or a plain date. */
    static func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) {
            return d.formatted(.dateTime.month(.abbreviated).day())
        }
        return Catalog.shortDate(iso)
    }

    /** "K7M2QX9R" shows as "K7M2-QX9R". Older links, which are longer and mixed case, show as they are. */
    static func formatInviteCode(_ token: String) -> String {
        let isCode = token.count == 8 && token.allSatisfy { ($0.isUppercase || $0.isNumber) && $0.isASCII }
        return isCode ? "\(token.prefix(4))-\(token.suffix(4))" : token
    }

    /** What someone pasted or typed into an invite box, reduced to the token, or nil if it is not one. */
    static func parseInviteInput(_ raw: String) -> String? {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        var token = text.filter { !$0.isWhitespace }
        if let r = text.range(of: #"/invite/([\w-]+)"#, options: .regularExpression) {
            token = String(text[r].dropFirst("/invite/".count))
        }
        let ok = (4...40).contains(token.count) && token.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
        return ok ? token : nil
    }
}
