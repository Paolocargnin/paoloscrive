// Scrittoio.app: the Scrittoio as a Mac app (ADR 0026).
//
// It starts the Scrittoio's local server from the paoloscrive checkout (the
// path and the Node binary are written into Info.plist by crea-app.mjs),
// shows it in its own window, and stops the server when the app quits. A
// server already running, for example from `pnpm scrittoio`, is replaced, so
// the app always runs the latest code.

import Cocoa
import WebKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
  private var window: NSWindow!
  private var webView: WKWebView!
  private var server: Process?
  private var ready = false
  private var output = ""

  private let info = Bundle.main.infoDictionary ?? [:]
  private var repository: String { info["ScrittoioRepository"] as? String ?? "" }
  private var nodePath: String { info["ScrittoioNode"] as? String ?? "" }
  private var port: Int { info["ScrittoioPort"] as? Int ?? 4322 }
  private var address: URL { URL(string: "http://localhost:\(port)/")! }
  private let logURL = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Logs/Scrittoio.log")

  private let paper = NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
      ? NSColor(red: 0.075, green: 0.082, blue: 0.071, alpha: 1)
      : NSColor(red: 0.953, green: 0.949, blue: 0.929, alpha: 1)
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    buildMenu()

    let configuration = WKWebViewConfiguration()
    configuration.preferences.isElementFullscreenEnabled = false
    webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.underPageBackgroundColor = paper
    webView.allowsMagnification = true

    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Scrittoio"
    window.backgroundColor = paper
    window.contentView = webView
    window.minSize = NSSize(width: 720, height: 480)
    if !window.setFrameUsingName("Scrittoio") {
      window.center()
    }
    window.setFrameAutosaveName("Scrittoio")
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)

    showMessage("Apro lo Scrittoio…")
    startServer()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  // Save what Paolo is writing before the server goes away.
  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard ready else { return .terminateNow }
    var replied = false
    let reply = {
      if !replied {
        replied = true
        NSApp.reply(toApplicationShouldTerminate: true)
      }
    }
    webView.callAsyncJavaScript(
      "if (window.scrittoioPrimaDiChiudere) { await window.scrittoioPrimaDiChiudere(); } return true;",
      arguments: [:],
      in: nil,
      in: .page
    ) { _ in reply() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { reply() }
    return .terminateLater
  }

  func applicationWillTerminate(_ notification: Notification) {
    if let server, server.isRunning {
      server.terminate()
    }
  }

  // MARK: Server

  private func startServer() {
    guard FileManager.default.fileExists(atPath: "\(repository)/scrittoio/server.mjs") else {
      showMessage(
        "Non trovo lo Scrittoio in \(repository).",
        detail: "Rilancia pnpm scrittoio:app dalla cartella di paoloscrive."
      )
      return
    }

    let process = Process()
    process.currentDirectoryURL = URL(fileURLWithPath: repository)
    let arguments = ["./scrittoio/server.mjs", "--port", String(port)]
    if FileManager.default.isExecutableFile(atPath: nodePath) {
      process.executableURL = URL(fileURLWithPath: nodePath)
      process.arguments = arguments
      var environment = ProcessInfo.processInfo.environment
      let nodeDirectory = (nodePath as NSString).deletingLastPathComponent
      environment["PATH"] = "\(nodeDirectory):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
      process.environment = environment
    } else {
      // Node moved (a new nvm version, say): ask the login shell where it is.
      process.executableURL = URL(fileURLWithPath: "/bin/zsh")
      process.arguments = ["-lic", "exec node " + arguments.joined(separator: " ")]
    }

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe
    pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let data = handle.availableData
      guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
      DispatchQueue.main.async { self?.received(text) }
    }
    process.terminationHandler = { [weak self] finished in
      let status = finished.terminationStatus
      DispatchQueue.main.async { self?.serverEnded(status: status) }
    }

    log("--- \(Date()) avvio dello Scrittoio\n")
    do {
      try process.run()
      server = process
    } catch {
      showMessage("Lo Scrittoio non parte.", detail: error.localizedDescription)
    }
  }

  private func received(_ text: String) {
    log(text)
    output += text
    if !ready && output.contains("Scrittoio aperto su") {
      ready = true
      webView.load(URLRequest(url: address))
    }
  }

  private func serverEnded(status: Int32) {
    if ready { return }
    if status == 0 {
      // An older Scrittoio that cannot step aside is still serving the port.
      ready = true
      webView.load(URLRequest(url: address))
    } else {
      showMessage(
        "Lo Scrittoio si è fermato.",
        detail: "\(output.suffix(600))\nIl registro completo è in ~/Library/Logs/Scrittoio.log."
      )
    }
  }

  private func log(_ text: String) {
    guard let data = text.data(using: .utf8) else { return }
    if !FileManager.default.fileExists(atPath: logURL.path) {
      FileManager.default.createFile(atPath: logURL.path, contents: nil)
    }
    if let handle = try? FileHandle(forWritingTo: logURL) {
      handle.seekToEndOfFile()
      handle.write(data)
      try? handle.close()
    }
  }

  private func showMessage(_ title: String, detail: String = "") {
    let escape = { (value: String) in
      value.replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
    }
    let page = """
      <!doctype html><meta charset="utf-8">
      <style>
        :root { color-scheme: light dark; }
        body { margin: 0; height: 100vh; display: grid; place-items: center;
          background: #f3f2ed; color: #1b1b18;
          font: 22px/1.4 "EB Garamond", Garamond, Georgia, serif; }
        @media (prefers-color-scheme: dark) { body { background: #131512; color: #ebe7da; } }
        main { max-width: 34rem; padding: 2rem; text-align: center; }
        h1 { font: italic 400 2.2rem "Bodoni 72", Didot, serif; margin: 0 0 1rem; }
        pre { text-align: left; white-space: pre-wrap; font-size: 0.7rem; opacity: 0.75; }
      </style>
      <main><h1>Scrittoio</h1><p>\(escape(title))</p><pre>\(escape(detail))</pre></main>
      """
    webView.loadHTMLString(page, baseURL: nil)
  }

  // MARK: Links

  // Drive links and materiali open in the default browser, not in this window.
  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = navigationAction.request.url {
      NSWorkspace.shared.open(url)
    }
    return nil
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
  ) {
    if let url = navigationAction.request.url,
      let host = url.host,
      !["localhost", "127.0.0.1"].contains(host)
    {
      NSWorkspace.shared.open(url)
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.allow)
  }

  // MARK: Menu

  private func buildMenu() {
    let main = NSMenu()

    let appItem = NSMenuItem()
    let appMenu = NSMenu()
    appMenu.addItem(
      withTitle: "Informazioni su Scrittoio",
      action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
      keyEquivalent: ""
    )
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Nascondi Scrittoio", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Esci da Scrittoio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu
    main.addItem(appItem)

    let editItem = NSMenuItem()
    let editMenu = NSMenu(title: "Modifica")
    editMenu.addItem(withTitle: "Annulla", action: Selector(("undo:")), keyEquivalent: "z")
    let redo = editMenu.addItem(withTitle: "Ripeti", action: Selector(("redo:")), keyEquivalent: "z")
    redo.keyEquivalentModifierMask = [.command, .shift]
    editMenu.addItem(.separator())
    editMenu.addItem(withTitle: "Taglia", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    editMenu.addItem(withTitle: "Copia", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    editMenu.addItem(withTitle: "Incolla", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    editMenu.addItem(withTitle: "Seleziona tutto", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = editMenu
    main.addItem(editItem)

    let viewItem = NSMenuItem()
    let viewMenu = NSMenu(title: "Vista")
    viewMenu.addItem(withTitle: "Ricarica", action: #selector(reload), keyEquivalent: "r")
    viewMenu.addItem(.separator())
    viewMenu.addItem(withTitle: "Ingrandisci", action: #selector(zoomIn), keyEquivalent: "+")
    viewMenu.addItem(withTitle: "Riduci", action: #selector(zoomOut), keyEquivalent: "-")
    viewMenu.addItem(withTitle: "Dimensioni reali", action: #selector(zoomReset), keyEquivalent: "0")
    viewItem.submenu = viewMenu
    main.addItem(viewItem)

    let windowItem = NSMenuItem()
    let windowMenu = NSMenu(title: "Finestra")
    windowMenu.addItem(withTitle: "Riduci a icona", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
    windowMenu.addItem(withTitle: "Ridimensiona", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
    windowItem.submenu = windowMenu
    main.addItem(windowItem)
    NSApp.windowsMenu = windowMenu

    NSApp.mainMenu = main
  }

  @objc private func reload() {
    if ready {
      webView.load(URLRequest(url: address))
    }
  }

  @objc private func zoomIn() { webView.pageZoom = min(webView.pageZoom + 0.1, 2) }
  @objc private func zoomOut() { webView.pageZoom = max(webView.pageZoom - 0.1, 0.6) }
  @objc private func zoomReset() { webView.pageZoom = 1 }
}

MainActor.assumeIsolated {
  let app = NSApplication.shared
  let delegate = AppDelegate()
  app.delegate = delegate
  app.setActivationPolicy(.regular)
  app.run()
}
