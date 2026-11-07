import Contacts
import ContactsUI
import LocalAuthentication
import MessageUI
import UIKit
import UserNotifications

// The system services Rally leans on: Messages, the contact picker, the share sheet, reminders and
// Face ID. Each one presents Apple's own UI.

enum Sent { case sent, cancelled }

@MainActor
private func topController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
        ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    var top = scene?.keyWindow?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
}

enum Share {
    /** Opens Messages with the text filled in, or the share sheet where Messages is not set up. */
    static func text(_ body: String, to phone: String? = nil) async -> Sent {
        guard MFMessageComposeViewController.canSendText() else { return await sheet(body) }
        return await withCheckedContinuation { cont in
            let vc = MFMessageComposeViewController()
            let delegate = MessageDelegate { result in cont.resume(returning: result == .sent ? .sent : .cancelled) }
            vc.body = body
            if let phone { vc.recipients = [phone] }
            vc.messageComposeDelegate = delegate
            objc_setAssociatedObject(vc, &MessageDelegate.key, delegate, .OBJC_ASSOCIATION_RETAIN)
            topController()?.present(vc, animated: true)
        }
    }

    /** The system share sheet: AirDrop, WhatsApp, Notes, copy. */
    static func sheet(_ body: String) async -> Sent {
        await withCheckedContinuation { cont in
            let vc = UIActivityViewController(activityItems: [body], applicationActivities: nil)
            vc.completionWithItemsHandler = { _, done, _, _ in cont.resume(returning: done ? .sent : .cancelled) }
            topController()?.present(vc, animated: true)
        }
    }

    /** Apple's contact picker, then a text to the first number on the contact that was picked. */
    static func textContact(_ body: String) async -> Sent {
        let phone: String? = await withCheckedContinuation { cont in
            let vc = CNContactPickerViewController()
            vc.displayedPropertyKeys = [CNContactPhoneNumbersKey]
            vc.predicateForEnablingContact = NSPredicate(format: "phoneNumbers.@count > 0")
            let delegate = ContactDelegate { cont.resume(returning: $0) }
            vc.delegate = delegate
            objc_setAssociatedObject(vc, &ContactDelegate.key, delegate, .OBJC_ASSOCIATION_RETAIN)
            topController()?.present(vc, animated: true)
        }
        guard let phone else { return .cancelled }
        try? await Task.sleep(for: .milliseconds(450)) // let the picker finish leaving first
        return await text(body, to: phone)
    }
}

private final class MessageDelegate: NSObject, MFMessageComposeViewControllerDelegate {
    nonisolated(unsafe) static var key = 0
    let done: (MessageComposeResult) -> Void
    init(done: @escaping (MessageComposeResult) -> Void) { self.done = done }
    func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: true)
        done(result)
    }
}

private final class ContactDelegate: NSObject, CNContactPickerDelegate {
    nonisolated(unsafe) static var key = 0
    let done: (String?) -> Void
    private var finished = false
    init(done: @escaping (String?) -> Void) { self.done = done }
    private func finish(_ v: String?) {
        guard !finished else { return }
        finished = true
        done(v)
    }
    func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
        finish(contact.phoneNumbers.first?.value.stringValue)
    }
    func contactPickerDidCancel(_ picker: CNContactPickerViewController) { finish(nil) }
}

enum Reminders {
    /** One reminder a day at the workout time, scheduled two weeks ahead so the words can rotate. */
    static func schedule(enabled: Bool, time: String, friend: String?, ask: Bool = false) async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        guard enabled else { return }
        var status = await center.notificationSettings().authorizationStatus
        if status == .notDetermined, ask {
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
            status = await center.notificationSettings().authorizationStatus
        }
        guard status == .authorized || status == .provisional else { return }
        let lines = Copy.reminderLines(friend: friend)
        let hour = Int(time.prefix(2)) ?? 7, minute = Int(time.suffix(2)) ?? 0
        let cal = Calendar.current
        for i in 0..<14 {
            guard let day = cal.date(byAdding: .day, value: i, to: .now),
                  let at = cal.date(bySettingHour: hour, minute: minute, second: 0, of: day), at > .now else { continue }
            let content = UNMutableNotificationContent()
            content.body = lines[Int(at.timeIntervalSince1970 / 86400) % lines.count]
            let trigger = UNCalendarNotificationTrigger(dateMatching: cal.dateComponents([.year, .month, .day, .hour, .minute], from: at), repeats: false)
            try? await center.add(UNNotificationRequest(identifier: "reminder-\(i)", content: content, trigger: trigger))
        }
    }
}

enum Biometrics {
    /** "Face ID" or "Touch ID" when one is set up, otherwise nil. */
    static var label: String? {
        let ctx = LAContext()
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else { return nil }
        return ctx.biometryType == .touchID ? "Touch ID" : "Face ID"
    }

    static func unlock(_ reason: String) async -> Bool {
        let ctx = LAContext()
        ctx.localizedCancelTitle = "Use PIN instead"
        return (try? await ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)) ?? false
    }
}
