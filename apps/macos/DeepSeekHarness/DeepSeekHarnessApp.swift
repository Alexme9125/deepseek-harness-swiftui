import AppKit
import SwiftUI

@main
struct DeepSeekHarnessApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @State private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      ContentView(model: model)
        .frame(minWidth: 960, minHeight: 640)
        .background(WindowFrameObserver())
        .onAppear {
          appDelegate.attach(model)
          model.startIfNeeded()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) { _ in
          model.stop()
        }
    }
    .defaultSize(width: WindowFrameStore.defaultWidth, height: WindowFrameStore.defaultHeight)
    .windowResizability(.contentMinSize)
    .commands {
      CommandGroup(replacing: .newItem) {
        Button("New Session") { model.newSession() }
          .keyboardShortcut("n")
          .disabled(!model.isReady)
        Button("Add Workspace…") { model.addWorkspace() }
          .keyboardShortcut("o")
      }
      CommandGroup(replacing: .appSettings) {
        Button("Settings…") { model.openSettings() }
          .keyboardShortcut(",")
          .disabled(!model.isReady)
      }
    }
  }
}

/// Receives Dock / Finder folder opens before or after the SwiftUI window appears.
final class AppDelegate: NSObject, NSApplicationDelegate {
  private weak var model: AppModel?
  private var pendingURLs: [URL] = []

  func attach(_ model: AppModel) {
    self.model = model
    let queued = pendingURLs
    pendingURLs.removeAll()
    if !queued.isEmpty {
      Task { @MainActor in
        model.openDroppedURLs(queued)
      }
    }
  }

  func application(_ application: NSApplication, open urls: [URL]) {
    if let model {
      Task { @MainActor in
        model.openDroppedURLs(urls)
      }
    } else {
      pendingURLs.append(contentsOf: urls)
    }
  }
}
