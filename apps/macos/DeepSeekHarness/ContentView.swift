import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
  @Bindable var model: AppModel

  var body: some View {
    Group {
      switch model.phase {
      case .idle, .starting:
        StatusPage(
          title: "Starting DeepSeek Harness",
          detail: "Launching `dsh web` on 127.0.0.1. The first source launch can take about a minute."
        )
      case .ready(let url):
        LoopbackWebView(
          url: url,
          onWebView: { model.attachWebView($0) },
          onFolderDrop: { model.openDroppedURLs($0) }
        )
      case .failed(let message):
        StatusPage(title: "Could not start DeepSeek Harness", detail: message, retry: { model.start() })
      }
    }
    .onDrop(of: [UTType.fileURL], isTargeted: nil, perform: handleDrop)
    .alert("Could not run the command", isPresented: chromeErrorPresented) {
      Button("OK", role: .cancel) { model.chromeError = nil }
    } message: {
      Text(model.chromeError ?? "")
    }
  }

  private var chromeErrorPresented: Binding<Bool> {
    Binding(
      get: { model.chromeError != nil },
      set: { if !$0 { model.chromeError = nil } }
    )
  }

  private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
    Task {
      let urls = await FolderPicker.fileURLs(from: providers)
      await MainActor.run { model.openDroppedURLs(urls) }
    }
    return providers.contains { $0.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) }
  }
}

private struct StatusPage: View {
  let title: String
  let detail: String
  var retry: (() -> Void)?

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if retry == nil {
        ProgressView()
      }
      Text(title)
        .font(.title2)
      Text(detail)
        .font(.body)
        .foregroundStyle(.secondary)
        .textSelection(.enabled)
      if let retry {
        Button("Try again", action: retry)
          .keyboardShortcut(.defaultAction)
      }
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}
