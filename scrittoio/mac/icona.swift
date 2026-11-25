// Draws the Scrittoio's app icon: the site's «ps» mark on a sheet of paper.
// Usage: swift icona.swift <output.png>

import AppKit

let size: CGFloat = 1024
let output = CommandLine.arguments.dropFirst().first ?? "icona.png"

let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()

let paper = NSColor(red: 0.953, green: 0.949, blue: 0.929, alpha: 1)
let ink = NSColor(red: 0.106, green: 0.106, blue: 0.094, alpha: 1)
let rule = NSColor(red: 0.804, green: 0.788, blue: 0.741, alpha: 1)

// The rounded square every Mac icon sits in, with a soft shadow.
let inset: CGFloat = 100
let sheet = NSRect(x: inset, y: inset, width: size - 2 * inset, height: size - 2 * inset)
let shape = NSBezierPath(roundedRect: sheet, xRadius: 185, yRadius: 185)
NSGraphicsContext.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.28)
shadow.shadowOffset = NSSize(width: 0, height: -12)
shadow.shadowBlurRadius = 28
shadow.set()
paper.setFill()
shape.fill()
NSGraphicsContext.restoreGraphicsState()
rule.setStroke()
shape.lineWidth = 4
shape.stroke()

// The mark: a ring with «ps» in Bodoni, as in the site's header.
let ringRadius: CGFloat = 250
let ring = NSBezierPath(
  ovalIn: NSRect(
    x: size / 2 - ringRadius, y: size / 2 - ringRadius,
    width: 2 * ringRadius, height: 2 * ringRadius))
ink.setStroke()
ring.lineWidth = 16
ring.stroke()

let font =
  NSFont(name: "BodoniSvtyTwoITCTT-Book", size: 250)
  ?? NSFont(name: "Didot", size: 250)
  ?? NSFont.systemFont(ofSize: 250)
let text = NSAttributedString(
  string: "ps",
  attributes: [.font: font, .foregroundColor: ink])
let textSize = text.size()
text.draw(at: NSPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2 + 18))

image.unlockFocus()

guard
  let tiff = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let png = bitmap.representation(using: .png, properties: [:])
else {
  fatalError("Non riesco a disegnare l'icona.")
}
try png.write(to: URL(fileURLWithPath: output))
