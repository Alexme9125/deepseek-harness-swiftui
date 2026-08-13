import Foundation

/// How the shell will invoke `dsh web`.
enum LaunchPlan: Equatable {
  /// An executable or shebang script, plus `web --host 127.0.0.1 --port <n>`.
  case executable(URL)
  /// Repository source launch: `node --import tsx/esm apps/cli/src/bin.ts web …`.
  case sourceRepo(root: URL, node: URL)
}

enum LaunchResolver {
  /// First existing match: `DSH_BIN`, bundled `dsh-web-host`, a checkout, then `dsh` on PATH.
  static func resolve(environment: [String: String] = ProcessInfo.processInfo.environment) throws -> LaunchPlan {
    if let explicit = environment["DSH_BIN"], !explicit.isEmpty {
      let url = URL(fileURLWithPath: explicit)
      guard FileManager.default.isExecutableFile(atPath: url.path) else {
        throw HarnessLaunchError.missingRuntime("DSH_BIN is set to \(url.path), but that path is not executable.")
      }
      return .executable(url)
    }

    if let bundled = Bundle.main.url(forAuxiliaryExecutable: "dsh-web-host")
      ?? Bundle.main.url(forResource: "dsh-web-host", withExtension: nil),
      FileManager.default.isExecutableFile(atPath: bundled.path)
    {
      return .executable(bundled)
    }

    let path = augmentedPath(environment: environment)
    if let repo = repositoryRoot(environment: environment) {
      let node = try requireNode(path: path)
      return .sourceRepo(root: repo, node: node)
    }

    if let dsh = which("dsh", path: path) {
      return .executable(dsh)
    }

    throw HarnessLaunchError.missingRuntime(
      """
      Could not find a DeepSeek Harness runtime.
      Set DSH_BIN to a `dsh` executable, set DSH_REPO to this checkout, or put `dsh` and Node 24 on your PATH.
      From this repository run `pnpm install` and `pnpm run build`, then `pnpm run build:macos-web-host` to embed `dsh-web-host`.
      """
    )
  }

  /// Child cwd: `DSH_CWD`, else the resolved checkout, else the user's home — never `/`.
  static func workingDirectory(environment: [String: String] = ProcessInfo.processInfo.environment) -> URL {
    if let cwd = environment["DSH_CWD"], !cwd.isEmpty {
      return URL(fileURLWithPath: cwd, isDirectory: true)
    }
    if let repo = repositoryRoot(environment: environment) {
      return repo
    }
    return FileManager.default.homeDirectoryForCurrentUser
  }

  static func augmentedPath(environment: [String: String] = ProcessInfo.processInfo.environment) -> String {
    var parts: [String] = []
    let extras = [environment["PATH"], loginShellPath(), "/opt/homebrew/bin", "/usr/local/bin"]
    for block in extras {
      guard let block, !block.isEmpty else { continue }
      for item in block.split(separator: ":") {
        let path = String(item)
        if !path.isEmpty, !parts.contains(path) {
          parts.append(path)
        }
      }
    }
    return parts.joined(separator: ":")
  }

  static func which(_ name: String, path: String) -> URL? {
    for directory in path.split(separator: ":") {
      let candidate = URL(fileURLWithPath: String(directory), isDirectory: true).appendingPathComponent(name)
      if FileManager.default.isExecutableFile(atPath: candidate.path) {
        return candidate
      }
    }
    return nil
  }

  private static func requireNode(path: String) throws -> URL {
    if let node = which("node", path: path) {
      return node
    }
    throw HarnessLaunchError.missingRuntime(
      "Found this repository checkout, but `node` is not on PATH. Install Node.js ^22.19 or >=24 and restart the app."
    )
  }

  private static func repositoryRoot(environment: [String: String]) -> URL? {
    let candidates: [URL?] = [
      environment["DSH_REPO"].map { URL(fileURLWithPath: $0, isDirectory: true) },
      compiledCheckoutRoot(),
      URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true),
    ]
    for candidate in candidates {
      guard let candidate, isRepositoryRoot(candidate) else { continue }
      return candidate.standardizedFileURL
    }
    return nil
  }

  /// Build-machine path of this file: `…/apps/macos/DeepSeekHarness/LaunchResolver.swift`.
  private static func compiledCheckoutRoot() -> URL? {
    let file = URL(fileURLWithPath: #filePath)
    let macos = file.deletingLastPathComponent().deletingLastPathComponent()
    guard macos.lastPathComponent == "macos" else { return nil }
    let apps = macos.deletingLastPathComponent()
    guard apps.lastPathComponent == "apps" else { return nil }
    return apps.deletingLastPathComponent()
  }

  private static func isRepositoryRoot(_ url: URL) -> Bool {
    let bin = url.appendingPathComponent("apps/cli/src/bin.ts")
    return FileManager.default.isReadableFile(atPath: bin.path)
  }

  private static func loginShellPath() -> String? {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/zsh")
    process.arguments = ["-l", "-c", "printenv PATH"]
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = FileHandle.nullDevice
    do {
      try process.run()
      process.waitUntilExit()
    } catch {
      return nil
    }
    guard process.terminationStatus == 0 else { return nil }
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    return path?.isEmpty == false ? path : nil
  }
}
