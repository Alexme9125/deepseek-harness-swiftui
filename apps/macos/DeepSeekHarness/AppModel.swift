import AppKit
import Foundation
import Observation
import WebKit

/// Owns the child `dsh web` process, the window phase, and native chrome commands.
@MainActor
@Observable
final class AppModel {
  enum Phase: Equatable {
    case idle
    case starting
    case ready(URL)
    case failed(String)
  }

  private(set) var phase: Phase = .idle
  var chromeError: String?
  private var process: HarnessProcess?
  private var webView: WKWebView?
  private var pendingCommands: [NativeCommand] = []
  private var flushTask: Task<Void, Never>?

  var isReady: Bool {
    if case .ready = phase { return true }
    return false
  }

  func startIfNeeded() {
    guard phase == .idle || isFailed else { return }
    start()
  }

  func start() {
    process?.stop()
    process = nil
    webView = nil
    phase = .starting
    let child = HarnessProcess()
    process = child
    Task { [weak self] in
      do {
        let url = try await child.start()
        self?.phase = .ready(url)
        self?.flushPendingCommands()
      } catch {
        self?.phase = .failed(error.localizedDescription)
        self?.process = nil
      }
    }
  }

  func stop() {
    flushTask?.cancel()
    flushTask = nil
    process?.stop()
    process = nil
    webView = nil
    if phase == .starting {
      phase = .idle
    }
  }

  func attachWebView(_ webView: WKWebView) {
    self.webView = webView
    flushPendingCommands()
  }

  func newSession() {
    enqueue(.newSession)
  }

  func openSettings() {
    enqueue(.openSettings)
  }

  func addWorkspace() {
    guard let url = FolderPicker.pickDirectory() else { return }
    enqueue(.addWorkspace(path: url.path))
  }

  func openDroppedURLs(_ urls: [URL]) {
    let folders = FolderPicker.directories(in: urls)
    guard !folders.isEmpty else { return }
    for folder in folders {
      enqueue(.addWorkspace(path: folder.path))
    }
  }

  func enqueue(_ command: NativeCommand) {
    pendingCommands.append(command)
    flushPendingCommands()
  }

  private func flushPendingCommands() {
    guard isReady, webView != nil, !pendingCommands.isEmpty, flushTask == nil else { return }
    flushTask = Task { [weak self] in
      await self?.sendPendingCommands()
      self?.flushTask = nil
      self?.flushPendingCommands()
    }
  }

  private func sendPendingCommands() async {
    guard let webView else { return }
    while !pendingCommands.isEmpty {
      let command = pendingCommands.removeFirst()
      if let error = await NativeCommandBridge.invoke(command, in: webView) {
        chromeError = error
      }
    }
  }

  private var isFailed: Bool {
    if case .failed = phase { return true }
    return false
  }
}
