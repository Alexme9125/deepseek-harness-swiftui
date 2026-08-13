import SwiftUI

struct ContentView: View {
  @Bindable var model: AppModel

  var body: some View {
    switch model.phase {
    case .idle, .starting:
      StatusPage(
        title: "Starting DeepSeek Harness",
        detail: "Launching `dsh web` on 127.0.0.1. The first source launch can take about a minute."
      )
    case .ready(let url):
      LoopbackWebView(url: url)
    case .failed(let message):
      StatusPage(title: "Could not start DeepSeek Harness", detail: message, retry: { model.start() })
    }
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
