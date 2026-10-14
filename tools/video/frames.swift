// Speichert Einzelbilder aus einem Video als JPEG (Vorschau zum Auswählen von Ausschnitten).
// Aufruf: swift tools/video/frames.swift datei.mp4 zielpräfix breite zeit1 zeit2 ...
import AVFoundation
import AppKit

let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
let w = Double(a[3])!
gen.maximumSize = CGSize(width: w, height: w)
for t in a[4...] {
    let time = CMTime(seconds: Double(t)!, preferredTimescale: 600)
    guard let cg = try? gen.copyCGImage(at: time, actualTime: nil) else { print("kein Bild bei", t); continue }
    let rep = NSBitmapImageRep(cgImage: cg)
    let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.8])!
    let out = "\(a[2])_\(t).jpg"
    try! data.write(to: URL(fileURLWithPath: out))
}
