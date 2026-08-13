import AppKit
import SwiftUI

/// Persists the product window frame in `UserDefaults`.
enum WindowFrameStore {
  static let key = "dsh.window.frame"
  static let defaultWidth: CGFloat = 1280
  static let defaultHeight: CGFloat = 800

  /// Write the window's current frame.
  /// - Parameter window: the product window.
  static func save(_ window: NSWindow) {
    UserDefaults.standard.set(NSStringFromRect(window.frame), forKey: key)
  }

  /// Restore a previously saved frame when it meets the content minimum.
  /// - Parameter window: the product window.
  static func restore(_ window: NSWindow) {
    guard let raw = UserDefaults.standard.string(forKey: key) else { return }
    let frame = NSRectFromString(raw)
    guard frame.width >= 960, frame.height >= 640 else { return }
    window.setFrame(frame, display: true)
  }
}

/// Finds the hosting `NSWindow` so the shell can restore and save its frame.
struct WindowFrameObserver: NSViewRepresentable {
  func makeNSView(context: Context) -> NSView {
    let view = ObserverView()
    view.onWindow = { window in
      WindowFrameStore.restore(window)
    }
    return view
  }

  func updateNSView(_ nsView: NSView, context: Context) {}

  private final class ObserverView: NSView {
    var onWindow: ((NSWindow) -> Void)?
    private var didRestore = false
    private var observations: [NSObjectProtocol] = []

    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      guard let window else { return }
      if !didRestore {
        didRestore = true
        onWindow?(window)
      }
      observations.forEach { NotificationCenter.default.removeObserver($0) }
      observations = [
        NotificationCenter.default.addObserver(
          forName: NSWindow.didEndLiveResizeNotification, object: window, queue: .main
        ) { [weak window] _ in
          if let window { WindowFrameStore.save(window) }
        },
        NotificationCenter.default.addObserver(
          forName: NSWindow.didMoveNotification, object: window, queue: .main
        ) { [weak window] _ in
          if let window { WindowFrameStore.save(window) }
        },
      ]
    }

    deinit {
      observations.forEach { NotificationCenter.default.removeObserver($0) }
    }
  }
}
