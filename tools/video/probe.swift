// Zeigt Größe, Drehung, Dauer und Bildrate von Videodateien.
// Aufruf: swift tools/video/probe.swift datei.mp4 ...
import AVFoundation

func fourCC(_ v: FourCharCode) -> String {
    let bytes: [UInt8] = [UInt8((v >> 24) & 255), UInt8((v >> 16) & 255), UInt8((v >> 8) & 255), UInt8(v & 255)]
    return String(decoding: bytes, as: UTF8.self)
}

for path in CommandLine.arguments.dropFirst() {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let sema = DispatchSemaphore(value: 0)
    Task {
        do {
            let tracks = try await asset.loadTracks(withMediaType: .video)
            let dur = try await asset.load(.duration)
            guard let t = tracks.first else { print("\(path): keine Videospur"); sema.signal(); return }
            let size = try await t.load(.naturalSize)
            let tf = try await t.load(.preferredTransform)
            let fps = try await t.load(.nominalFrameRate)
            let rate = try await t.load(.estimatedDataRate)
            let fmts = try await t.load(.formatDescriptions)
            var codec = "?"
            if let f = fmts.first { codec = fourCC(CMFormatDescriptionGetMediaSubType(f)) }
            let name = (path as NSString).lastPathComponent
            let secs = String(format: "%.2f", dur.seconds)
            print("\(name): \(Int(size.width))x\(Int(size.height)) tf=[\(tf.a),\(tf.b),\(tf.c),\(tf.d)] \(secs)s \(fps)fps \(Int(rate / 1000))kbps \(codec)")
        } catch { print("\(path): \(error)") }
        sema.signal()
    }
    sema.wait()
}
