import AppKit
import SwiftUI
import WebKit

/// Loads the local `dsh web` origin. Non-loopback navigations open in the default browser.
struct LoopbackWebView: NSViewRepresentable {
  let url: URL

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeNSView(context: Context) -> WKWebView {
    let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    webView.navigationDelegate = context.coordinator
    webView.allowsBackForwardNavigationGestures = true
    webView.load(URLRequest(url: url))
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {
    guard webView.url != url else { return }
    webView.load(URLRequest(url: url))
  }

  final class Coordinator: NSObject, WKNavigationDelegate {
    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard let target = navigationAction.request.url else {
        decisionHandler(.cancel)
        return
      }
      if isAllowedInWebView(target) {
        decisionHandler(.allow)
        return
      }
      NSWorkspace.shared.open(target)
      decisionHandler(.cancel)
    }
  }
}

func isAllowedInWebView(_ url: URL) -> Bool {
  if url.scheme == "about" { return true }
  guard let host = url.host?.lowercased() else { return false }
  if host == "127.0.0.1" || host == "::1" || host == "[::1]" { return true }
  if host.hasPrefix("127.") { return true }
  return false
}
