import ManagedSettings
import ManagedSettingsUI
import UIKit
import SwiftUI

// This extension customizes the 'Restricted' screen that users see when an app is blocked by Screen Time.
class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        return ShieldConfiguration(
            backgroundBlurStyle: .dark,
            backgroundColor: .black,
            icon: UIImage(systemName: "link.badge.plus"),
            title: ShieldConfiguration.Label(text: "INTENT_GATE_ENGAGED", color: .white),
            subtitle: ShieldConfiguration.Label(text: "Brief pause. Why are you opening this app?", color: .gray),
            primaryButtonLabel: ShieldConfiguration.Label(text: "OPEN_INTENT_GATE", color: .black),
            primaryButtonBackgroundColor: .white,
            secondaryButtonLabel: ShieldConfiguration.Label(text: "GO_HOME", color: .white)
        )
    }
}
