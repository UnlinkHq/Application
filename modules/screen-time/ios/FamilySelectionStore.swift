import Foundation
import FamilyControls
import ManagedSettings

@available(iOS 16.0, *)
class FamilySelectionStore: ObservableObject {
    static let shared = FamilySelectionStore()
    
    @Published var selection = FamilyActivitySelection() {
        didSet {
            saveSelection()
        }
    }
    
    private let userDefaultsKey = "UnlinkFamilySelection"
    
    init() {
        loadSelection()
    }
    
    func saveSelection() {
        let encoder = JSONEncoder()
        if let encoded = try? encoder.encode(selection) {
            UserDefaults.standard.set(encoded, forKey: userDefaultsKey)
        }
    }
    
    func loadSelection() {
        if let data = UserDefaults.standard.data(forKey: userDefaultsKey) {
            let decoder = JSONDecoder()
            if let decoded = try? decoder.decode(FamilyActivitySelection.self, from: data) {
                selection = decoded
            }
        }
    }
}
