import SwiftUI
import FamilyControls

@available(iOS 16.0, *)
struct FamilyPickerView: View {
    @Binding var selection: FamilyActivitySelection
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $selection)
                .navigationTitle("Select Targets")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            dismiss()
                        }
                    }
                }
        }
    }
}
