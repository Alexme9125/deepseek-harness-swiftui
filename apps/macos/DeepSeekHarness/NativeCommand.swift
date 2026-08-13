import Foundation
import WebKit

/// Commands the macOS chrome sends into the loaded Web client.
enum NativeCommand: Equatable {
  case newSession
  case addWorkspace(path: String)
  case openSettings

  var payload: [String: String] {
    switch self {
    case .newSession:
      return ["name": "new-session"]
    case .addWorkspace(let path):
      return ["name": "add-workspace", "path": path]
    case .openSettings:
      return ["name": "open-settings"]
    }
  }
}

/// Dispatches a native command through `window.__dshNativeInvoke`.
enum NativeCommandBridge {
  /// Document-start stub so a command issued before runtime apply stays queued.
  static let bootstrapScript = """
    (() => {
      const g = globalThis;
      g.__dshNativeQueue = g.__dshNativeQueue || [];
      if (typeof g.__dshNativeInvoke !== 'function') {
        g.__dshNativeInvoke = (detail) => new Promise((resolve, reject) => {
          g.__dshNativeQueue.push({ detail, resolve, reject });
        });
      }
    })();
    """

  /**
   Call the page invoke function and return its `{ ok, error }` result.
   - Parameter webView: the loopback WKWebView.
   - Parameter command: the chrome command.
   - Returns: nil on success, or an error string from the client.
   */
  @MainActor
  static func invoke(_ command: NativeCommand, in webView: WKWebView) async -> String? {
    do {
      let result = try await webView.callAsyncJavaScript(
        "return await globalThis.__dshNativeInvoke(command);",
        arguments: ["command": command.payload],
        in: nil,
        in: .page
      )
      return errorMessage(from: result)
    } catch {
      return error.localizedDescription
    }
  }

  private static func errorMessage(from result: Any?) -> String? {
    guard let object = result as? [String: Any] else { return nil }
    if object["ok"] as? Bool == true { return nil }
    if let error = object["error"] as? String, !error.isEmpty { return error }
    return "The Web client rejected the command."
  }
}
