import UIKit
import Capacitor
import WebKit

/// Capacitor's web view grants motion silently, so iOS never shows the permission
/// sheet. This delegate asks the system to prompt, and forwards every other UI call.
private final class MotionPromptProxy: NSObject, WKUIDelegate {
    weak var forward: WKUIDelegate?

    func webView(
        _ webView: WKWebView,
        requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.prompt)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return forward?.responds(to: aSelector) ?? false
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let forward, forward.responds(to: aSelector) { return forward }
        return super.forwardingTarget(for: aSelector)
    }
}

/// Registers local plugins and locks portrait orientation.
@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController {
    private let motionPrompt = MotionPromptProxy()
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var shouldAutorotate: Bool {
        false
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AdvancedHapticsPlugin())
        CAPLog.print("⚡️ AdvancedHapticsPlugin registered")
        if let webView {
            motionPrompt.forward = webView.uiDelegate
            webView.uiDelegate = motionPrompt
        }
    }
}
