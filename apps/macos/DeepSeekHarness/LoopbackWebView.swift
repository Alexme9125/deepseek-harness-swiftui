import AppKit
import SwiftUI
import UniformTypeIdentifiers
import WebKit

/// Loads the local `dsh web` origin. Non-loopback navigations open in the default browser.
struct LoopbackWebView: NSViewRepresentable {
  let url: URL
  var onWebView: ((WKWebView) -> Void)?
  var onFolderDrop: (([URL]) -> Void)?

  func makeCoordinator() -> Coordinator {
    Coordinator(onWebView: onWebView, onFolderDrop: onFolderDrop)
  }

  func makeNSView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    let bootstrap = WKUserScript(
      source: NativeCommandBridge.bootstrapScript,
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    configuration.userContentController.addUserScript(bootstrap)
    let webView = DropAwareWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.allowsBackForwardNavigationGestures = true
    webView.registerForDraggedTypes([.fileURL])
    webView.onFolderDrop = { [weak coordinator = context.coordinator] urls in
      coordinator?.onFolderDrop?(urls)
    }
    context.coordinator.webView = webView
    webView.load(URLRequest(url: url))
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {
    context.coordinator.onWebView = onWebView
    context.coordinator.onFolderDrop = onFolderDrop
    if let dropView = webView as? DropAwareWebView {
      dropView.onFolderDrop = { urls in context.coordinator.onFolderDrop?(urls) }
    }
    guard webView.url != url else { return }
    webView.load(URLRequest(url: url))
  }

  final class Coordinator: NSObject, WKNavigationDelegate {
    var onWebView: ((WKWebView) -> Void)?
    var onFolderDrop: (([URL]) -> Void)?
    weak var webView: WKWebView?

    init(onWebView: ((WKWebView) -> Void)?, onFolderDrop: (([URL]) -> Void)?) {
      self.onWebView = onWebView
      self.onFolderDrop = onFolderDrop
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      onWebView?(webView)
    }

    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard let target = navigationAction.request.url else {
        decisionHandler(.cancel)
        return
      }
      if target.isFileURL {
        let folders = FolderPicker.directories(in: [target])
        if !folders.isEmpty {
          onFolderDrop?(folders)
        }
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

/// WKWebView that claims folder drags before they become `file://` navigations.
final class DropAwareWebView: WKWebView {
  var onFolderDrop: (([URL]) -> Void)?

  override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
    folderURLs(from: sender).isEmpty ? super.draggingEntered(sender) : .copy
  }

  override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
    folderURLs(from: sender).isEmpty ? super.draggingUpdated(sender) : .copy
  }

  override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
    let folders = folderURLs(from: sender)
    if folders.isEmpty {
      return super.performDragOperation(sender)
    }
    onFolderDrop?(folders)
    return true
  }

  private func folderURLs(from sender: NSDraggingInfo) -> [URL] {
    let urls = sender.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: [
      .urlReadingFileURLsOnly: true,
    ]) as? [URL] ?? []
    return FolderPicker.directories(in: urls)
  }
}

func isAllowedInWebView(_ url: URL) -> Bool {
  if url.scheme == "about" { return true }
  guard let host = url.host?.lowercased() else { return false }
  if host == "127.0.0.1" || host == "::1" || host == "[::1]" { return true }
  if host.hasPrefix("127.") { return true }
  return false
}
