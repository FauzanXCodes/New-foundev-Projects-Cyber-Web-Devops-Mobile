import CoreMotion
import Foundation
import Observation

/**
 * Steps, straight from the iPhone's own step counter (the motion coprocessor that counts whether or not
 * any app is open). When it is switched on, today's count is sent to the server whenever Rally comes to
 * the front, and becomes today's number in every steps challenge you are in. No Apple Health link and no
 * account: the phone asks once for Motion & Fitness access and that is all.
 */
@Observable
final class StepSync {
    static let shared = StepSync()
    private static let key = "stepSync"

    /** What the phone last reported for today. Nil until it has been read. */
    private(set) var today: Int?
    private(set) var denied = false
    var enabled: Bool {
        didSet {
            UserDefaults.standard.set(enabled, forKey: Self.key)
            if enabled { Task { await sync() } }
        }
    }

    @ObservationIgnored private let pedometer = CMPedometer()
    @ObservationIgnored private var lastSent = -1

    private init() { enabled = UserDefaults.standard.bool(forKey: Self.key) }

    /** False on devices with no step counter, such as the Simulator. */
    var available: Bool { CMPedometer.isStepCountingAvailable() }

    /** Reads today's steps and, if they have moved, tells the server. Safe to call often. */
    func sync() async {
        guard enabled, available, API.shared.signedIn else { return }
        let start = Calendar.current.startOfDay(for: .now)
        let steps: Int? = await withCheckedContinuation { cont in
            pedometer.queryPedometerData(from: start, to: .now) { data, _ in
                cont.resume(returning: data?.numberOfSteps.intValue)
            }
        }
        denied = CMPedometer.authorizationStatus() == .denied || CMPedometer.authorizationStatus() == .restricted
        guard let steps else { return }
        today = steps
        // Not every few steps: only when the number has moved enough to matter on a standings page.
        guard abs(steps - lastSent) >= 100 || lastSent < 0 else { return }
        struct Reply: Decodable { var challenges: Int }
        if let reply = try? await API.shared.send("/steps", body: ["steps": steps], as: Reply.self) {
            // The first time it works, say so: otherwise there is no sign anything happened.
            if lastSent < 0, reply.challenges > 0, !UserDefaults.standard.bool(forKey: "stepsAnnounced") {
                UserDefaults.standard.set(true, forKey: "stepsAnnounced")
                Toaster.shared.show(Toast(emoji: "👟", title: "Steps are counting", detail: "\(Catalog.fmt(Double(steps))) today, added to your steps challenges."))
            }
            lastSent = steps
        }
    }
}
