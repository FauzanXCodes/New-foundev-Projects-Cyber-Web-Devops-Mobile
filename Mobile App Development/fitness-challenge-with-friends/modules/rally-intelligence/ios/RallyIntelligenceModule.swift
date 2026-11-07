import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Apple Intelligence through the on-device Foundation Models framework (iOS 26). Nothing leaves the
/// phone. On phones without Apple Intelligence `availability()` says why and the app shows what it
/// always has.
public final class RallyIntelligenceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RallyIntelligence")

    /// "available", or why not: "deviceNotEligible", "notEnabled", "modelNotReady", "unsupported".
    Function("availability") { () -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available: return "available"
        case .unavailable(.deviceNotEligible): return "deviceNotEligible"
        case .unavailable(.appleIntelligenceNotEnabled): return "notEnabled"
        case .unavailable(.modelNotReady): return "modelNotReady"
        case .unavailable: return "unsupported"
        }
      }
      #endif
      return "unsupported"
    }

    AsyncFunction("recap") { (facts: String) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await Generator.recap(facts)
      }
      #endif
      throw NotAvailable()
    }

    AsyncFunction("consequenceIdeas") { (context: String) async throws -> [String] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await Generator.consequenceIdeas(context)
      }
      #endif
      throw NotAvailable()
    }
  }
}

final class NotAvailable: Exception, @unchecked Sendable {
  override var reason: String { "Apple Intelligence is not available on this device" }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct ConsequenceIdeas {
  @Guide(description: "Three different consequences for whoever finishes last", .count(3))
  var ideas: [String]
}

@available(iOS 26.0, *)
enum Generator {
  static func recap(_ facts: String) async throws -> String {
    let session = LanguageModelSession(instructions: """
      You write a short update for one person in a friendly fitness challenge with their friends. \
      Write one or two short sentences, 30 words at most, speaking to them as "you". \
      Use plain everyday words, like a friend texting. Be warm and a little playful, never mean. \
      Use only the facts you are given. Never invent numbers, names or events. \
      No emoji, no hashtags, no quotation marks.
      """)
    let response = try await session.respond(
      to: "Facts:\n\(facts)\n\nWrite the update.",
      options: GenerationOptions(temperature: 0.6)
    )
    return response.content.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"")))
  }

  static func consequenceIdeas(_ context: String) async throws -> [String] {
    let session = LanguageModelSession(instructions: """
      You suggest small, friendly forfeits for whoever finishes last in a fitness challenge among \
      friends. Each idea is a short phrase of 3 to 8 words that starts with a verb, like \
      "Buys coffee" or "Sings at the next hangout". Keep every idea kind, cheap and fun for the \
      whole group.
      """)
    let response = try await session.respond(
      to: "The challenge: \(context)\nSuggest three fresh ideas.",
      generating: ConsequenceIdeas.self,
      options: GenerationOptions(temperature: 0.9)
    )
    return response.content.ideas
  }
}
#endif
