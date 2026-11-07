import Observation
import SwiftUI

@main
struct RallyApp: App {
    @State private var api = API.shared
    @State private var router = Router()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(Appearance.key) private var appearance = Appearance.fallback.rawValue

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(api)
                .environment(router)
                .tint(Palette.accent)
                .onOpenURL { router.open($0) }
                // Each time Rally comes to the front, today's steps go to any steps challenges.
                .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await StepSync.shared.sync() } } }
                .onAppear { Appearance.apply(DebugDemo.flag("RallyDark") ? .dark : DebugDemo.flag("RallyLight") ? .light : AppearanceChoice(rawValue: appearance) ?? Appearance.fallback) }
                .onChange(of: appearance) { _, v in Appearance.apply(AppearanceChoice(rawValue: v) ?? Appearance.fallback) }
        }
    }
}

enum Route: Hashable {
    case challenge(String)
    case settings
    case join
    case workouts
    case signup
    case signin(invite: String?)
}

enum AppTab: Hashable { case home, checkin, me }

struct InviteLink: Identifiable, Hashable { var token: String; var id: String { token } }

@Observable
final class Router {
    /** Debug only: -RallyStartMe YES opens on the Me tab. */
    var tab: AppTab = DebugDemo.flag("RallyStartMe") ? .me : .home
    var home: [Route] = []
    var me: [Route] = []
    var auth: [Route] = []
    var invite: InviteLink?
    var creating = false
    /** Home has been scrolled past its top, which is when Start a challenge moves into the tab bar. */
    var homeScrolled = false
    var logging: String?

    /** fitchallenge://invite/<token> and fitchallenge://challenge/<id>. */
    func open(_ url: URL) {
        let parts = ([url.host()].compactMap { $0 } + url.pathComponents).filter { $0 != "/" && !$0.isEmpty }
        guard parts.count >= 2 else { return }
        switch parts[parts.count - 2] {
        case "invite": invite = InviteLink(token: parts.last!)
        case "challenge": show(challenge: parts.last!)
        default: break
        }
    }

    func show(challenge id: String) {
        tab = .home
        home = [.challenge(id)]
    }

    func signedOut() {
        tab = .home
        home = []
        me = []
        auth = []
    }
}

/** The answer behind one screen: shown from the cache straight away, refreshed from the server. */
@Observable
final class Remote<T: Decodable> {
    var path: String
    var data: T?
    var error: String?

    init(_ path: String) {
        self.path = path
        data = API.shared.cached(path)
    }

    func load() async {
        do {
            let fresh: T = try await API.shared.send(path)
            withAnimation(Motion.fluid) {
                data = fresh
                error = nil
            }
        } catch is CancellationError {
        } catch let e as URLError where e.code == .cancelled {
        } catch {
            withAnimation(Motion.fluid) { self.error = error.localizedDescription }
        }
    }
}

extension View {
    /** Loads when the screen appears and again after any change made anywhere in the app. */
    func loads<T>(_ remote: Remote<T>) -> some View {
        task(id: API.shared.version) { await remote.load() }
            .refreshable { await remote.load() }
    }
}

struct RootView: View {
    @Environment(API.self) private var api
    @Environment(Router.self) private var router
    @State private var whatsNew = false

    var body: some View {
        @Bindable var router = router
        Group {
            if DebugDemo.requested {
                DebugDemo()
            } else if api.signedIn && !DebugDemo.welcome {
                MainTabs()
                    .transition(.liquid)
            } else {
                NavigationStack(path: $router.auth) {
                    WelcomeView()
                        .navigationDestination(for: Route.self) { route in
                            switch route {
                            case .signup: SignUpView()
                            case .signin(let invite): SignInView(invite: invite)
                            default: EmptyView()
                            }
                        }
                }
                .transition(.liquid)
            }
        }
        .animation(Motion.wave, value: api.signedIn)
        .onChange(of: api.signedIn) { _, signedIn in if !signedIn { router.signedOut() } }
        .fullScreenCover(item: $router.invite) { link in
            InviteView(token: link.token)
                .environment(api)
                .environment(router)
                .overlay { ToastHost() }
        }
        // Banners sit above everything, including the tab bar and navigation.
        .overlay { ToastHost() }
        .sheet(isPresented: $whatsNew) { WhatsNewSheet() }
        .onAppear {
            // Debug only: -RallyToastDemo YES plays a few sample banners.
            if DebugDemo.flag("RallyToastDemo") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                    Toaster.shared.show(Toast(emoji: "👀", title: "Dana logged today", detail: "Your turn?", actionTitle: "Check in", action: {}, seconds: 4))
                    Toaster.shared.show(Toast(emoji: "✨", title: "A new version of Rally is ready", detail: "Update in TestFlight to get it.", actionTitle: "Update", action: {}, seconds: 4))
                    Toaster.shared.show(Toast(emoji: "💡", title: "Did you know?", detail: FunFacts.all[6], seconds: 5))
                }
                return
            }
            if !DebugDemo.requested, WhatsNew.shouldShow(signedIn: api.signedIn) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { whatsNew = true }
            }
        }
    }
}

struct MainTabs: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            Tab("Home", systemImage: "house.fill", value: AppTab.home) {
                NavigationStack(path: $router.home) {
                    HomeView().withDestinations()
                }
            }
            Tab("Check-in", systemImage: "checkmark.circle.fill", value: AppTab.checkin) {
                NavigationStack {
                    CheckInView().withDestinations()
                }
            }
            Tab("Me", systemImage: "person.fill", value: AppTab.me) {
                NavigationStack(path: $router.me) {
                    MeView().withDestinations()
                }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        // SwiftUI's tab bar accessory: once Home is scrolled, Start a challenge comes out of the tab bar
        // and rides beside it, the way the mini player does in Music.
        .tabViewBottomAccessory(isEnabled: router.tab == .home && router.home.isEmpty && router.homeScrolled) {
            StartAccessory { router.creating = true }
        }
        .sensoryFeedback(.selection, trigger: router.tab)
        .sheet(isPresented: $router.creating) { CreateView() }
        .sheet(item: Binding(get: { router.logging.map(InviteLink.init) }, set: { router.logging = $0?.token })) { item in
            LogSheet(challengeId: item.token)
        }
    }
}

/** Start a challenge, as it appears in the tab bar. */
struct StartAccessory: View {
    var action: () -> Void
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement

    var body: some View {
        Button {
            Haptic.tap(.medium)
            action()
        } label: {
            Label("Start a challenge", systemImage: "plus.circle.fill")
                .font(.headline)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(Palette.accent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, placement == .inline ? 8 : 16)
    }
}

extension View {
    func withDestinations() -> some View {
        navigationDestination(for: Route.self) { route in
            switch route {
            case .challenge(let id): ChallengeScreen(id: id)
            case .settings: SettingsView()
            case .join: JoinView()
            case .workouts: WorkoutLogView()
            default: EmptyView()
            }
        }
    }
}
