import AppKit
import UniformTypeIdentifiers

/// Directory selection for Add Workspace and folder drops.
enum FolderPicker {
  /// Present an `NSOpenPanel` that accepts one existing directory.
  /// - Returns: the chosen folder URL, or nil when the user cancelled.
  @MainActor
  static func pickDirectory() -> URL? {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    panel.canCreateDirectories = true
    panel.prompt = "Add"
    panel.message = "Choose a folder to add as a workspace."
    guard panel.runModal() == .OK else { return nil }
    return panel.url
  }

  /// Keep only paths that exist as directories.
  /// - Parameter urls: file URLs from a drop, Open With, or the open panel.
  /// - Returns: directory URLs in the same order.
  static func directories(in urls: [URL]) -> [URL] {
    urls.filter { url in
      var isDirectory: ObjCBool = false
      return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
        && isDirectory.boolValue
    }
  }

  /// Load file URLs from a SwiftUI / AppKit drop payload.
  /// - Parameter providers: item providers that may contain `public.file-url`.
  /// - Returns: successfully decoded file URLs (not yet filtered to directories).
  static func fileURLs(from providers: [NSItemProvider]) async -> [URL] {
    var urls: [URL] = []
    for provider in providers {
      guard provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) else { continue }
      if let url = await loadFileURL(provider) {
        urls.append(url)
      }
    }
    return urls
  }

  private static func loadFileURL(_ provider: NSItemProvider) async -> URL? {
    await withCheckedContinuation { continuation in
      provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
        if let url = item as? URL {
          continuation.resume(returning: url)
          return
        }
        if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
          continuation.resume(returning: url)
          return
        }
        continuation.resume(returning: nil)
      }
    }
  }
}
