import UIKit
import Capacitor

final class AppBridgeViewController: CAPBridgeViewController {
    private lazy var backSwipeGesture: UIScreenEdgePanGestureRecognizer = {
        let gesture = UIScreenEdgePanGestureRecognizer(
            target: self,
            action: #selector(handleBackSwipe(_:))
        )
        gesture.edges = .left
        gesture.cancelsTouchesInView = true
        return gesture
    }()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView else { return }

        // A Capacitor app uses a single WKWebView, so UIKit has no navigation
        // controller pop gesture to provide. Handle the screen-edge gesture
        // ourselves and let WebKit move through the Next.js history stack.
        webView.allowsBackForwardNavigationGestures = false
        webView.addGestureRecognizer(backSwipeGesture)
        webView.scrollView.panGestureRecognizer.require(toFail: backSwipeGesture)
    }

    @objc private func handleBackSwipe(_ gesture: UIScreenEdgePanGestureRecognizer) {
        guard gesture.state == .ended, let webView else { return }

        let translation = gesture.translation(in: webView)
        let velocity = gesture.velocity(in: webView)
        let travelledFarEnough = translation.x >= 64
        let flickedFastEnough = velocity.x >= 520

        guard travelledFarEnough || flickedFastEnough else { return }

        if webView.canGoBack {
            webView.goBack()
        } else {
            // `pushState` entries can briefly lag behind WKBackForwardList.
            // This fallback still triggers Next.js's normal popstate handling.
            webView.evaluateJavaScript(
                "if (window.history.length > 1) { window.history.back(); }"
            )
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AppBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
