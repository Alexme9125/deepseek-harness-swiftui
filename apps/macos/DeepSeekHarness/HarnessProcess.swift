import Darwin
import Foundation

enum HarnessLaunchError: LocalizedError, Equatable {
  case missingRuntime(String)
  case exited(status: Int32, stderr: String)
  case timedOut(seconds: TimeInterval)
  case listenFailed(String)

  var errorDescription: String? {
    switch self {
    case .missingRuntime(let message), .listenFailed(let message):
      return message
    case .exited(let status, let stderr):
      let tail = stderr.trimmingCharacters(in: .whitespacesAndNewlines)
      if tail.isEmpty {
        return "The harness process exited with status \(status)."
      }
      return "The harness process exited with status \(status).\n\n\(tail)"
    case .timedOut(let seconds):
      return "The harness process did not become ready within \(Int(seconds)) seconds. Confirm `pnpm run build` has produced `apps/web/dist`."
    }
  }
}

/// Spawns `dsh web --host 127.0.0.1 --port <n>` and waits until `GET /` succeeds.
final class HarnessProcess: @unchecked Sendable {
  private let lock = NSLock()
  private var process: Process?
  private var stderrBuffer = Data()
  private var stopped = false

  func start() async throws -> URL {
    let environment = ProcessInfo.processInfo.environment
    let plan = try LaunchResolver.resolve(environment: environment)
    let port = try reserveLoopbackPort()
    let url = loopbackURL(port: port)
    let cwd = LaunchResolver.workingDirectory(environment: environment)
    let path = LaunchResolver.augmentedPath(environment: environment)

    let child = Process()
    child.currentDirectoryURL = cwd
    child.qualityOfService = .userInitiated
    var env = LaunchResolver.environmentForChild(environment)
    env["PATH"] = path
    child.environment = env

    switch plan {
    case .executable(let executable):
      child.executableURL = executable
      child.arguments = ["web", "--host", "127.0.0.1", "--port", String(port)]
    case .sourceRepo(let root, let node):
      child.currentDirectoryURL = root
      child.executableURL = node
      child.arguments = ["--import", "tsx/esm", "apps/cli/src/bin.ts", "web", "--host", "127.0.0.1", "--port", String(port)]
    }

    let stderr = Pipe()
    child.standardOutput = FileHandle.nullDevice
    child.standardError = stderr
    stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let chunk = handle.availableData
      guard !chunk.isEmpty else { return }
      self?.appendStderr(chunk)
    }

    try run(child)
    do {
      try await waitUntilReady(url: url, child: child)
      return url
    } catch {
      stop()
      throw error
    }
  }

  func stop() {
    lock.lock()
    stopped = true
    let child = process
    process = nil
    lock.unlock()
    guard let child else { return }
    terminate(child)
  }

  private func run(_ child: Process) throws {
    lock.lock()
    if stopped {
      lock.unlock()
      throw HarnessLaunchError.listenFailed("Launch was cancelled.")
    }
    process = child
    lock.unlock()
    do {
      try child.run()
    } catch {
      throw HarnessLaunchError.listenFailed("Failed to start the harness process: \(error.localizedDescription)")
    }
  }

  private func waitUntilReady(url: URL, child: Process, timeout: TimeInterval = 90) async throws {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if !child.isRunning {
        throw HarnessLaunchError.exited(status: child.terminationStatus, stderr: stderrText())
      }
      if await probe(url) {
        return
      }
      try await Task.sleep(for: .milliseconds(200))
    }
    throw HarnessLaunchError.timedOut(seconds: timeout)
  }

  private func probe(_ url: URL) async -> Bool {
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 1
    do {
      let (_, response) = try await URLSession.shared.data(for: request)
      return (response as? HTTPURLResponse)?.statusCode == 200
    } catch {
      return false
    }
  }

  private func terminate(_ child: Process) {
    let pid = child.processIdentifier
    if child.isRunning {
      child.terminate()
      let deadline = Date().addingTimeInterval(10)
      while child.isRunning, Date() < deadline {
        Thread.sleep(forTimeInterval: 0.05)
      }
    }
    if child.isRunning, pid > 0 {
      kill(pid, SIGKILL)
      child.waitUntilExit()
    }
  }

  private func appendStderr(_ chunk: Data) {
    lock.lock()
    stderrBuffer.append(chunk)
    if stderrBuffer.count > 8_192 {
      stderrBuffer.removeSubrange(0..<(stderrBuffer.count - 8_192))
    }
    lock.unlock()
  }

  private func stderrText() -> String {
    lock.lock()
    let data = stderrBuffer
    lock.unlock()
    return String(data: data, encoding: .utf8) ?? ""
  }
}

func loopbackURL(port: UInt16) -> URL {
  URL(string: "http://127.0.0.1:\(port)/")!
}

/// Bind `127.0.0.1:0`, read the assigned port, then close. Another process may grab the port before `dsh` listens.
func reserveLoopbackPort() throws -> UInt16 {
  let fd = Darwin.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
  guard fd >= 0 else {
    throw HarnessLaunchError.listenFailed("Could not create a loopback socket.")
  }
  defer { Darwin.close(fd) }

  var value: Int32 = 1
  _ = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &value, socklen_t(MemoryLayout<Int32>.size))

  var addr = sockaddr_in()
  addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
  addr.sin_family = sa_family_t(AF_INET)
  addr.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
  addr.sin_port = 0

  let bindResult = withUnsafePointer(to: &addr) { pointer in
    pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
      Darwin.bind(fd, sockaddrPointer, socklen_t(MemoryLayout<sockaddr_in>.size))
    }
  }
  guard bindResult == 0 else {
    throw HarnessLaunchError.listenFailed("Could not bind a free 127.0.0.1 port.")
  }

  var bound = sockaddr_in()
  var length = socklen_t(MemoryLayout<sockaddr_in>.size)
  let nameResult = withUnsafeMutablePointer(to: &bound) { pointer in
    pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
      getsockname(fd, sockaddrPointer, &length)
    }
  }
  guard nameResult == 0 else {
    throw HarnessLaunchError.listenFailed("Could not read the reserved loopback port.")
  }
  let port = UInt16(bigEndian: bound.sin_port)
  guard port != 0 else {
    throw HarnessLaunchError.listenFailed("The reserved loopback port was 0.")
  }
  return port
}
