import Foundation
import Observation
import Security

struct APIError: LocalizedError {
    var status: Int
    var message: String
    var errorDescription: String? { message }
}

/** The account this phone remembers, so Welcome can say "Welcome back" and offer Face ID. */
struct LockedAccount: Codable {
    var token: String
    var name: String
    var avatar: Int
}

/**
 * Talks to the Rally server, holds the session, and remembers the last answer for each screen.
 * One shared instance, put in the environment by the app.
 */
@Observable
final class API {
    static let shared = API()

    private(set) var token: String?
    /** Bumped by every write, so mounted screens know to load again. */
    private(set) var version = 0

    let base: String

    private let sessionKey = "session-token"
    private let lockedKey = "locked-account"
    private var memory: [String: Data] = [:]
    @ObservationIgnored private let urlSession: URLSession

    private init() {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "RallyAPIURL") as? String) ?? ""
        base = configured.isEmpty || configured.contains("$(") ? "http://localhost:8787" : configured.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let config = URLSessionConfiguration.default
        // A request that has not answered in this long is not going to. Without a limit, iOS waits a
        // full minute on a host that has changed address or a Wi-Fi that dropped.
        config.timeoutIntervalForRequest = 10
        config.waitsForConnectivity = false
        urlSession = URLSession(configuration: config)
        token = Keychain.get(sessionKey)
    }

    var signedIn: Bool { token != nil }

    // ---------- session ----------

    func setSession(_ newToken: String?) {
        // Cached screens belong to whoever was signed in; never let them show up for someone else.
        if newToken != token { clearCache() }
        if let newToken { Keychain.set(sessionKey, newToken) } else { Keychain.delete(sessionKey) }
        token = newToken
    }

    func rememberAccount(_ a: LockedAccount) {
        if let data = try? JSONEncoder().encode(a), let s = String(data: data, encoding: .utf8) { Keychain.set(lockedKey, s) }
    }

    func rememberedAccount() -> LockedAccount? {
        guard let s = Keychain.get(lockedKey), let data = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(LockedAccount.self, from: data)
    }

    func forgetAccount() { Keychain.delete(lockedKey) }

    // ---------- links ----------

    /** A web link when the server has a public address (it taps in Messages and shows the invite page);
     the app's own link scheme when it is only reachable on the local network. */
    func inviteLink(_ token: String) -> String {
        base.hasPrefix("https://") ? "\(base)/invite/\(token)" : "fitchallenge://invite/\(token)"
    }

    // ---------- requests ----------

    @discardableResult
    func send<T: Decodable>(_ path: String, method: String? = nil, body: [String: Any]? = nil, as: T.Type = T.self) async throws -> T {
        let verb = method ?? (body != nil ? "POST" : "GET")
        var req = URLRequest(url: URL(string: "\(base)/api\(path)")!)
        req.httpMethod = verb
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(Catalog.localDate(), forHTTPHeaderField: "X-Today")
        // The free ngrok tunnel answers some requests with its own warning page unless this is set.
        req.setValue("1", forHTTPHeaderField: "ngrok-skip-browser-warning")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }

        // Reads are safe to repeat, so one dropped connection is retried quietly. Writes never are:
        // a second POST could log twice.
        let tries = verb == "GET" ? 2 : 1
        var result: (Data, URLResponse)?
        var timedOut = false
        for i in 0..<tries where result == nil {
            if i > 0 { try? await Task.sleep(for: .milliseconds(350)) }
            do {
                result = try await urlSession.data(for: req)
            } catch let e as URLError {
                timedOut = e.code == .timedOut
            }
        }
        guard let (data, response) = result, let http = response as? HTTPURLResponse else {
            throw APIError(status: 0, message: timedOut
                ? "The server is taking too long to answer. Check your connection and try again."
                : "Can't reach the server. Check your connection and try again.")
        }
        if http.statusCode == 401, token != nil { setSession(nil) }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError(status: http.statusCode, message: message ?? "Something went wrong. Try again.")
        }
        if verb != "GET" { version += 1 }
        if verb == "GET", cacheable(path) { remember(path, data) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    // ---------- last-known data ----------
    // Each screen's last answer is kept so a cold launch shows real content immediately and the app
    // stays usable when the connection drops. It is only trusted for the same calendar day: streaks and
    // "logged today" turn over at midnight. Check-in is never cached; that screen is about today.

    private func cacheable(_ path: String) -> Bool { !path.hasPrefix("/checkin") }

    private var cacheDir: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("views", isDirectory: true)
    }

    private func file(_ path: String) -> URL {
        cacheDir.appendingPathComponent(Data(path.utf8).base64EncodedString().replacingOccurrences(of: "/", with: "_"))
    }

    private func remember(_ path: String, _ data: Data) {
        memory[path] = data
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        let stamped = Catalog.localDate().data(using: .utf8)! + Data([0x0A]) + data
        try? stamped.write(to: file(path))
    }

    func cached<T: Decodable>(_ path: String, as: T.Type = T.self) -> T? {
        guard cacheable(path) else { return nil }
        if let data = memory[path] { return try? JSONDecoder().decode(T.self, from: data) }
        guard let stamped = try? Data(contentsOf: file(path)), let nl = stamped.firstIndex(of: 0x0A) else { return nil }
        guard String(data: stamped[..<nl], encoding: .utf8) == Catalog.localDate() else { return nil }
        return try? JSONDecoder().decode(T.self, from: stamped[(nl + 1)...])
    }

    func clearCache() {
        memory.removeAll()
        try? FileManager.default.removeItem(at: cacheDir)
    }
}

/**
 * The Keychain, in the same layout expo-secure-store used, so someone signed in to the earlier build
 * of Rally stays signed in. `ThisDeviceOnly` keeps the token off iCloud Keychain and out of backups.
 */
enum Keychain {
    private static func query(_ key: String) -> [String: Any] {
        let encoded = Data(key.utf8)
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "app:no-auth",
            kSecAttrGeneric as String: encoded,
            kSecAttrAccount as String: encoded,
        ]
    }

    static func get(_ key: String) -> String? {
        var q = query(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ key: String, _ value: String) {
        delete(key)
        var q = query(key)
        q[kSecValueData as String] = Data(value.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(q as CFDictionary, nil)
    }

    static func delete(_ key: String) {
        SecItemDelete(query(key) as CFDictionary)
    }
}
