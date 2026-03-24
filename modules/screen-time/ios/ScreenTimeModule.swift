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

    AsyncFunction("getUsageStats") { (startTime: Double, endTime: Double) -> [String: Any] in
      return [:]
    }

    AsyncFunction("getInstalledApps") { () -> [[String: String]] in
      return []
    }

    // Register the Native View
    View(ScreenTimeReportBridgeView.self) {
      // Define properties or events here if needed
    }
  }
}

@available(iOS 16.0, *)
struct ScreenTimeReportBridgeView: ExpoView {
    @State private var context: DeviceActivityReport.Context = .init(rawValue: "Interactive Report")
    @State private var filter = DeviceActivityFilter(
        segment: .daily(during: Calendar.current.dateInterval(of: .day, for: .now)!)
    )
    
    var body: some View {
        DeviceActivityReport(context, filter: filter)
    }
}
