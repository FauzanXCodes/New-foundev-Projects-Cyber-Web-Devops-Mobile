import Foundation
import FoundationModels

// Apple Intelligence through the on-device Foundation Models framework. Nothing leaves the phone.
// Every use is an extra: without Apple Intelligence (older iPhones, or turned off) the screens show
// exactly what they would otherwise.

@Generable
struct ConsequenceIdeas {
    @Guide(description: "Three different consequences for whoever finishes last", .count(3))
    var ideas: [String]
}

enum Intelligence {
    static var available: Bool {
        guard !missing else { return false }
        if case .available = SystemLanguageModel.default.availability { return true }
        return false
    }

    // Set when a request finds the model missing even though it was reported available (the
    // Simulator does this when the Mac has Apple Intelligence off). Hides the AI pieces from then on.
    private static var missing = false

    private static func note(_ error: Error) {
        #if DEBUG
        print("Intelligence error:", error)
        #endif
        if case LanguageModelSession.GenerationError.assetsUnavailable = error { missing = true }
    }

    /** The standings, in words the model can retell without doing any maths of its own. */
    static func facts(_ d: ChallengeDetail) -> String {
        var lines = ["Challenge: \(d.name), \(d.targetText)."]
        lines.append(d.status == "done" ? "It is over. \(d.resultText ?? "")" : "Time: \(d.daysLeftText).")
        for s in d.standings {
            let who = s.isYou ? "\(s.name) (this is you)" : s.name
            var move = ""
            if let delta = s.delta {
                move = ", \(delta.hasPrefix("-") ? "down" : "up") \(delta.trimmingCharacters(in: CharacterSet(charactersIn: "+-"))) places this week"
            }
            let hook = s.onTheHook ? ", currently in last place and on the hook for the consequence" : ""
            lines.append("Place \(s.rank): \(who), \(s.label) done (\(s.percent)%)\(move)\(hook).")
        }
        if d.consequence?.status == "agreed", let text = d.consequence?.text { lines.append("Whoever finishes last: \(text).") }
        return lines.joined(separator: "\n")
    }

    // One recap per set of facts for as long as the app is open.
    private static var recaps: [String: String] = [:]

    static func recap(_ d: ChallengeDetail) async -> String? {
        guard available, d.status != "waiting", d.standings.count >= 2 else { return nil }
        let facts = facts(d)
        if let hit = recaps[facts] { return hit }
        let session = LanguageModelSession(instructions: """
            You write a short update for one person in a friendly fitness challenge with their friends. \
            Write one or two short sentences, 30 words at most, speaking to them as "you". \
            Use plain everyday words, like a friend texting. Be warm and a little playful, never mean. \
            Use only the facts you are given. Never invent numbers, names or events. \
            No emoji, no hashtags, no quotation marks.
            """)
        let r: LanguageModelSession.Response<String>
        do {
            r = try await session.respond(to: "Facts:\n\(facts)\n\nWrite the update.", options: GenerationOptions(temperature: 0.6))
        } catch {
            note(error)
            return nil
        }
        let text = r.content.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"")))
        guard !text.isEmpty else { return nil }
        recaps[facts] = text
        return text
    }

    static func consequenceIdeas(for context: String) async -> [String] {
        guard available else { return [] }
        let session = LanguageModelSession(instructions: """
            You suggest small, friendly forfeits for whoever finishes last in a fitness challenge among \
            friends. Each idea is a short phrase of 3 to 8 words that starts with a verb, like \
            "Buys coffee" or "Sings at the next hangout". Keep every idea kind, cheap and fun for the \
            whole group.
            """)
        let r: LanguageModelSession.Response<ConsequenceIdeas>
        do {
            r = try await session.respond(
                to: "The challenge: \(context)\nSuggest three fresh ideas.",
                generating: ConsequenceIdeas.self,
                options: GenerationOptions(temperature: 0.9))
        } catch {
            note(error)
            return []
        }
        return r.content.ideas
            .map { $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: ".!")) }
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .filter { $0.count > 2 && $0.count <= 80 && Copy.offLimitsReason($0) == nil }
    }
}
