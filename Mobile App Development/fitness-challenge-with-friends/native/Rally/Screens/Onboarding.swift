import SwiftUI

/** The very first thing a signed-out phone sees. A phone that already has an account says welcome back. */
struct WelcomeView: View {
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var remembered: LockedAccount? = API.shared.rememberedAccount()
    @State private var busy = false
    @State private var inviteOpen = false
    @State private var rise = 0.0

    var body: some View {
        VStack(spacing: Metrics.gap) {
            Spacer()
            if let remembered {
                AvatarView(person: Person(id: "", name: remembered.name, avatar: remembered.avatar), size: 84)
                    .settles(0)
                Text("Welcome back, \(remembered.name).")
                    .font(.display)
                    .multilineTextAlignment(.center)
                    .settles(1)
            } else {
                WaterCircle(level: rise, size: 120) {
                    Image(systemName: "figure.run")
                        .font(.system(size: 50, weight: .semibold))
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
                }
                .settles(0)
                Text("Rally").font(.display).settles(1)
                Text("A friend invites you to a challenge. You log one thing a day. The app keeps score.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Palette.stone)
                    .frame(maxWidth: 300)
                    .settles(2)
            }
            Spacer()
            VStack(spacing: Metrics.gap) {
                if let remembered {
                    let bio = Biometrics.label
                    PrimaryButton(title: bio.map { "Unlock with \($0)" } ?? "Continue", symbol: bio == "Touch ID" ? "touchid" : bio != nil ? "faceid" : nil, busy: busy) {
                        Task {
                            busy = true
                            let ok = bio == nil ? true : await Biometrics.unlock("Sign in as \(remembered.name)")
                            if ok { api.setSession(remembered.token) }
                            busy = false
                        }
                    }
                    TextButton(title: "Not you? Use a different account") {
                        api.forgetAccount()
                        withAnimation(Motion.wave) { self.remembered = nil }
                    }
                } else {
                    PrimaryButton(title: "Create account") { router.auth.append(.signup) }
                    SecondaryButton(title: "Sign in") { router.auth.append(.signin(invite: nil)) }
                    TextButton(title: "Have an invite?") { inviteOpen = true }
                }
            }
            .settles(3)
        }
        .padding(.horizontal, Metrics.screen)
        .padding(.bottom, Metrics.screen)
        .background {
            WaterBackdrop(strength: 0.22)
                .overlay(alignment: .top) {
                    PhotoBanner(name: "welcome", emoji: "🤝", height: 340, fadeTo: Palette.page)
                        .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: .bottom))
                        .ignoresSafeArea()
                }
        }
        .sheet(isPresented: $inviteOpen) { InviteCodeSheet() }
        .onAppear { withAnimation(.easeInOut(duration: 1.6).delay(0.3)) { rise = 0.62 } }
    }
}

/** Five questions, one per screen. The last one is optional. */
struct SignUpView: View {
    @Environment(API.self) private var api
    @State private var step = 0
    @State private var name = ""
    @State private var tracked: [String] = []
    @State private var band = "active"
    @State private var time = "07:00"
    @State private var phone = ""
    @State private var pin = ""
    @State private var busy = false
    @State private var error: String?

    private var digits: String { phone.filter(\.isNumber) }

    var body: some View {
        Page {
            Group {
                switch step {
                case 0:
                    Text("What should we call you? 👋").font(.display).accessibilityLabel("What should we call you?")
                    RallyField(placeholder: "Your name", text: $name, capitalization: .words, maxLength: 30) { if !name.trimmed.isEmpty { next() } }
                case 1:
                    Text("What do you want to keep track of?").font(.display)
                    MultiChipPicker(options: Catalog.trackTypes.map { ChipOption(id: $0, label: Catalog.info($0).label, emoji: Catalog.emoji($0)) }, selection: $tracked, max: 3)
                    Text("Pick two or three.").font(.footnote).foregroundStyle(Palette.stone)
                case 2:
                    Text("How active are you?").font(.display)
                    ChipPicker(options: Catalog.bands.map { ChipOption(id: $0.key, label: $0.label, emoji: Catalog.bandEmoji[$0.key]) }, selection: band) { band = $0 }
                    Text("Sets your own step and mile goals, so a steps challenge is a fair fight either way.").foregroundStyle(Palette.stone)
                case 3:
                    Text("When do you usually work out? ⏰").font(.display).accessibilityLabel("When do you usually work out?")
                    WheelPicker(label: "Workout time", values: Catalog.times, value: $time, format: Catalog.timeLabel)
                    Text("We'll remind you once a day.").foregroundStyle(Palette.stone)
                default:
                    Text("Save your account?").font(.display)
                    RallyField(placeholder: "(555) 010-2030", text: $phone, keyboard: .phonePad, maxLength: 20)
                    PinPad(value: $pin).frame(maxWidth: .infinity)
                    Text("Add a phone number and a 4 digit PIN so you can sign back in on a new phone. Optional: skip it and Done still creates your account.")
                        .foregroundStyle(Palette.stone)
                }
            }
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .liquid), removal: .move(edge: .leading).combined(with: .liquid)))
            .id(step)
        } footer: {
            ErrorLine(text: error)
            if step < 4 {
                PrimaryButton(title: "Next", busy: busy, disabled: (step == 0 && name.trimmed.isEmpty) || (step == 1 && tracked.count < 2)) { next() }
            } else {
                PrimaryButton(title: "Done") { Task { await finish() } }
            }
        }
        .navigationBarBackButtonHidden(step > 0)
        .toolbar {
            if step > 0 {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Back", systemImage: "chevron.left") { withAnimation(Motion.wave) { step -= 1 } }
                }
            }
        }
        .animation(Motion.wave, value: step)
    }

    private func next() { withAnimation(Motion.wave) { step += 1 } }

    private func finish() async {
        busy = true
        error = nil
        var body: [String: Any] = ["name": name.trimmed, "trackedTypes": tracked, "band": band, "workoutTime": time]
        if digits.count == 10 && pin.count == 4 {
            body["phone"] = digits
            body["pin"] = pin
        }
        do {
            let res: SignupResult = try await api.send("/signup", body: body)
            api.rememberAccount(LockedAccount(token: res.token, name: res.user.name, avatar: res.user.avatar))
            api.setSession(res.token)
            Haptic.success()
            await Reminders.schedule(enabled: true, time: time, friend: nil, ask: true)
        } catch {
            withAnimation(Motion.fluid) { self.error = error.localizedDescription }
            busy = false
        }
    }
}

/** Signing in on a phone that doesn't remember you. Two questions, one each. */
struct SignInView: View {
    var invite: String?
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var step = 0
    @State private var phone = ""
    @State private var pin = ""
    @State private var busy = false
    @State private var error: String?

    private var digits: String { phone.filter(\.isNumber) }

    var body: some View {
        Page {
            if step == 0 {
                Text("What's your phone number?").font(.display)
                RallyField(placeholder: "(555) 010-2030", text: $phone, keyboard: .phonePad, maxLength: 20)
                Text("The number you added when you set up your PIN.").foregroundStyle(Palette.stone)
            } else {
                Text("Enter your PIN").font(.display).frame(maxWidth: .infinity)
                PinPad(value: $pin)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Metrics.gap)
                    .modifier(Shake(times: error == nil ? 0 : 1))
                    .onChange(of: pin) { _, v in
                        if !v.isEmpty { error = nil }
                        if v.count == 4 { Task { await submit(v) } }
                    }
            }
        } footer: {
            ErrorLine(text: error)
            if step == 0 {
                PrimaryButton(title: "Next", disabled: digits.count != 10) { withAnimation(Motion.wave) { step = 1 } }
                TextButton(title: "Don't have an account? Create one") { router.auth = [.signup] }
            }
        }
        .animation(Motion.wave, value: step)
        .animation(Motion.fluid, value: error)
    }

    private func submit(_ finalPin: String) async {
        guard !busy else { return }
        busy = true
        do {
            let res: SignupResult = try await api.send("/signin", body: ["phone": digits, "pin": finalPin])
            api.rememberAccount(LockedAccount(token: res.token, name: res.user.name, avatar: res.user.avatar))
            api.setSession(res.token)
            Haptic.success()
            if let invite { router.invite = InviteLink(token: invite) }
        } catch {
            Haptic.warning()
            self.error = error.localizedDescription
            pin = ""
        }
        busy = false
    }
}

/** A wrong PIN shakes the dots, the way the lock screen does. */
struct Shake: GeometryEffect {
    var times: CGFloat
    var animatableData: CGFloat {
        get { times }
        set { times = newValue }
    }
    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(times * .pi * 6), y: 0))
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
