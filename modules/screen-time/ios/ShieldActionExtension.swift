import ManagedSettings
import ManagedSettingsUI
import UIKit

// This extension handles the button clicks on the Shield (Restricted) screen.
class ShieldActionExtension: ShieldActionDelegate {
    
    override func handle(action: ShieldAction, for application: Application, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        switch action {
        case .primaryButtonTapped:
            // OPEN_INTENT_GATE: Deep link into the Unlink app to show the Intent Gate screen
            if let url = URL(string: "unlink://intent-gate?app=\(application.bundleIdentifier ?? "app")") {
                // Background extension cannot open URLs directly via UIApplication, but it can trigger a response
                // that allows the system to handle the transition if configured correctly.
                // For direct 'Open App' behavior, usually we use NSExtensionContext if available or close the shield.
                completionHandler(.close) 
                
                // In a real implementation, the user would then manually open Unlink or we use a more advanced URL scheme.
            } else {
                completionHandler(.close)
            }
        case .secondaryButtonTapped:
            // GO_HOME: Just close the shield (which keeps the app blocked)
            completionHandler(.close)
        @unknown default:
            completionHandler(.close)
        }
    }
}
