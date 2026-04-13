import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI
import DeviceActivity

public class ScreenTimeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScreenTime")

    AsyncFunction("hasPermission") { () -> Bool in
      if #available(iOS 15.0, *) {
        let status = AuthorizationCenter.shared.authorizationStatus
        return status == .approved
      }
      return false
    }

    AsyncFunction("requestPermission") { (promise: Promise) in
      if #available(iOS 16.0, *) {
        Task {
          do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            promise.resolve(true)
          } catch {
            promise.reject("AUTH_ERROR", "Failed to request authorization: \(error.localizedDescription)")
          }
        }
      } else {
        promise.reject("OS_VERSION", "Requires iOS 16.0+")
      }
    }

    // Shielding Logic (Opal-style Blocking)
    Function("activateShield") {
      if #available(iOS 16.0, *) {
        let selection = FamilySelectionStore.shared.selection
        let store = ManagedSettingsStore()
        
        // Apply the shield to categories and applications
        store.shield.applications = selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
        store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : ShieldSettings.ActivityCategoryPolicy.specific(selection.categoryTokens)
      }
    }

    Function("deactivateShield") {
      if #available(iOS 16.0, *) {
        let store = ManagedSettingsStore()
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomainCategories = nil
      }
    }

    Function("getSelectionCount") { () -> Int in
      if #available(iOS 16.0, *) {
        let selection = FamilySelectionStore.shared.selection
        return selection.applicationTokens.count + selection.categoryTokens.count
      }
      return 0
    }

    // Register Native View for Picker
    View(FamilyPickerExpoView.self) {
      // Logic for the view can be added here
    }
  }
}

@available(iOS 16.0, *)
class FamilyPickerExpoView: ExpoView {
    private var hostingController: UIHostingController<FamilyPickerView>?

    // Using a simple wrapper around the SwiftUI View
    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        
        let store = FamilySelectionStore.shared
        // Binding to the shared store
        let contentView = FamilyPickerView(selection: Binding(
            get: { store.selection },
            set: { store.selection = $0 }
        ))
        
        let controller = UIHostingController(rootView: contentView)
        self.hostingController = controller
        
        // Ensure the hosting controller's view stays matched to our size
        if let pickerView = controller.view {
            pickerView.backgroundColor = .clear
            addSubview(pickerView)
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        hostingController?.view.frame = bounds
    }
}
