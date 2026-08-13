import Foundation
import Observation

/// Owns the child `dsh web` process and the window phase the SwiftUI views render.
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
  private var process: HarnessProcess?

  func startIfNeeded() {
    guard phase == .idle || isFailed else { return }
    start()
  }

  func start() {
    process?.stop()
    process = nil
    phase = .starting
    let child = HarnessProcess()
    process = child
    Task { [weak self] in
      do {
        let url = try await child.start()
        self?.phase = .ready(url)
      } catch {
        self?.phase = .failed(error.localizedDescription)
        self?.process = nil
      }
    }
  }

  func stop() {
    process?.stop()
    process = nil
    if phase == .starting {
      phase = .idle
    }
  }

  private var isFailed: Bool {
    if case .failed = phase { return true }
    return false
  }
}
