import AppKit
import SwiftUI

@main
struct DeepSeekHarnessApp: App {
  @State private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      ContentView(model: model)
        .frame(minWidth: 960, minHeight: 640)
        .onAppear { model.startIfNeeded() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) { _ in
          model.stop()
        }
    }
    .defaultSize(width: 1280, height: 800)
    .windowResizability(.contentMinSize)
  }
}
