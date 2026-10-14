// Schneidet Videos zu (Zeit und Bildausschnitt), skaliert sie und speichert das Ergebnis
// als H.264-MP4 fürs Web: ohne Ton, „Fast Start“, kurze Keyframe-Abstände.
// Mehrere Abschnitte (auch aus verschiedenen Dateien) werden mit weicher Überblendung
// aneinandergehängt. Einzelne Bilder lassen sich als JPEG speichern (Poster, Vorschau).
//
// Aufruf mit einem Abschnitt:
//   swift tools/video/cut.swift --in quelle.mp4 --start 1.2 --end 11.2 --crop x,y,w,h \
//     --out ziel.mp4 --size 720x900 --bitrate 1200000 [--fps 25] [--still 3.0:bild.jpg]
//
// Mit mehreren Abschnitten (Zeiten und Ausschnitt je Abschnitt, Überblendung in Sekunden):
// Weitere Optionen: --mono (Schwarz-Weiß), --speed 0.5 (Zeitlupe; Bildrate dann mit --fps festlegen),
// --blur bereiche.txt (Bereiche wie Kennzeichen weichzeichnen, Format siehe tools/video/intro-g-kennzeichen.txt).
//
//   swift tools/video/cut.swift --seg a.mp4:0:4.5:724,0,864,1080 --seg b.mp4:4.2:9.7:162,760,864,1080 \
//     --xfade 0.5 --out ziel.mp4 --size 720x900
//
// Der Ausschnitt wird in Pixeln der Quelle angegeben, Ursprung oben links. Die Zeit bei
// --still bezieht sich auf das fertige Video.

import AVFoundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

struct Segment {
    var file: String
    var start: Double
    var end: Double
    var crop: CGRect?
}

struct Options {
    var segments: [Segment] = []
    var output = ""
    var width = 720
    var height = 900
    var bitrate = 1_200_000
    var fps: Double? = nil
    var xfade = 0.0
    var stills: [(Double, String)] = []
    var quality = 0.9
    var mono = false   // Schwarz-Weiß
    var speed = 1.0    // < 1 = Zeitlupe (z. B. 0.5 macht aus 60 fps-Material 30 fps in halber Geschwindigkeit)
    var blur: [[(t: Double, r: CGRect)]] = [] // Bereiche weichzeichnen (z. B. Kennzeichen), Zeit im fertigen Video
}

/// Datei mit Spuren „zeit x y b h“ (Pixel im fertigen Bild, Ursprung oben links), Leerzeile trennt Spuren
func loadBlur(_ path: String) -> [[(t: Double, r: CGRect)]] {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { fail("Kann \(path) nicht lesen") }
    var tracks: [[(t: Double, r: CGRect)]] = [[]]
    for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
        let l = line.trimmingCharacters(in: .whitespaces)
        if l.hasPrefix("#") { continue }
        if l.isEmpty { if !(tracks.last!.isEmpty) { tracks.append([]) }; continue }
        let v = l.split(separator: " ").compactMap { Double($0) }
        if v.count != 5 { fail("Zeile „\(l)“ braucht zeit x y b h") }
        tracks[tracks.count - 1].append((v[0], CGRect(x: v[1], y: v[2], width: v[3], height: v[4])))
    }
    return tracks.filter { !$0.isEmpty }
}

func blurBoxes(_ tracks: [[(t: Double, r: CGRect)]], at t: Double) -> [CGRect] {
    tracks.compactMap { k in
        guard let first = k.first, let last = k.last, t >= first.t, t <= last.t else { return nil }
        let i = max(1, k.firstIndex { $0.t >= t } ?? 1)
        let a = k[i - 1], b = k[i]
        let x = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0
        func mix(_ p: Double, _ q: Double) -> Double { p + (q - p) * x }
        return CGRect(x: mix(a.r.minX, b.r.minX), y: mix(a.r.minY, b.r.minY), width: mix(a.r.width, b.r.width), height: mix(a.r.height, b.r.height))
    }
}

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(1)
}

func rect(_ s: Substring) -> CGRect {
    let p = s.split(separator: ",").compactMap { Double($0) }
    if p.count != 4 { fail("Ausschnitt braucht x,y,w,h") }
    return CGRect(x: p[0], y: p[1], width: p[2], height: p[3])
}

func parse() -> Options {
    var o = Options()
    var single = Segment(file: "", start: 0, end: .infinity, crop: nil)
    var args = Array(CommandLine.arguments.dropFirst())
    func next() -> String { if args.isEmpty { fail("Wert fehlt") }; return args.removeFirst() }
    while !args.isEmpty {
        let a = args.removeFirst()
        switch a {
        case "--in": single.file = next()
        case "--start": single.start = Double(next()) ?? 0
        case "--end": single.end = Double(next()) ?? .infinity
        case "--crop": single.crop = rect(Substring(next()))
        case "--seg":
            // datei:start:ende[:x,y,w,h]
            let p = next().split(separator: ":", omittingEmptySubsequences: false)
            if p.count < 3 { fail("--seg braucht datei:start:ende[:x,y,w,h]") }
            o.segments.append(Segment(file: String(p[0]), start: Double(p[1]) ?? 0, end: Double(p[2]) ?? .infinity, crop: p.count > 3 ? rect(p[3]) : nil))
        case "--out": o.output = next()
        case "--size":
            let p = next().split(separator: "x").compactMap { Int($0) }
            if p.count != 2 { fail("--size braucht BxH") }
            o.width = p[0]; o.height = p[1]
        case "--bitrate": o.bitrate = Int(next()) ?? o.bitrate
        case "--fps": o.fps = Double(next())
        case "--xfade": o.xfade = Double(next()) ?? 0
        case "--quality": o.quality = Double(next()) ?? o.quality
        case "--mono": o.mono = true
        case "--speed": o.speed = Double(next()) ?? 1
        case "--blur": o.blur = loadBlur(next())
        case "--still":
            let v = next()
            guard let i = v.firstIndex(of: ":"), let t = Double(v[..<i]) else { fail("--still braucht zeit:datei") }
            o.stills.append((t, String(v[v.index(after: i)...])))
        default: fail("Unbekannte Option \(a)")
        }
    }
    if !single.file.isEmpty { o.segments.insert(single, at: 0) }
    if o.segments.isEmpty { fail("--in oder --seg angeben") }
    if o.output.isEmpty && o.stills.isEmpty { fail("--out oder --still angeben") }
    return o
}

func saveJPEG(_ image: CGImage, to path: String, quality: Double) {
    let url = URL(fileURLWithPath: path) as CFURL
    guard let dest = CGImageDestinationCreateWithURL(url, UTType.jpeg.identifier as CFString, 1, nil) else { fail("Kann \(path) nicht schreiben") }
    CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    if !CGImageDestinationFinalize(dest) { fail("Kann \(path) nicht schreiben") }
}

final class Encoder {
    let o: Options
    let W: Int, H: Int
    let step: Double
    // Ohne Farbmanagement: Pixelwerte bleiben unverändert, nur Ausschnitt und Größe ändern sich
    let ctx = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull(), .highQualityDownsample: true])
    var writer: AVAssetWriter?
    var input: AVAssetWriterInput?
    var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    var pool: CVPixelBufferPool?
    var written = 0
    var stills: [(Double, String)]

    init(_ o: Options, fps: Double) throws {
        self.o = o
        W = o.width; H = o.height
        step = 1.0 / fps
        stills = o.stills.sorted { $0.0 < $1.0 }
        let attrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: W,
            kCVPixelBufferHeightKey as String: H,
            kCVPixelBufferIOSurfacePropertiesKey as String: [:],
        ]
        CVPixelBufferPoolCreate(nil, nil, attrs as CFDictionary, &pool)
        guard !o.output.isEmpty else { return }
        try? FileManager.default.removeItem(atPath: o.output)
        let w = try AVAssetWriter(outputURL: URL(fileURLWithPath: o.output), fileType: .mp4)
        w.shouldOptimizeForNetworkUse = true
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: W,
            AVVideoHeightKey: H,
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
            ],
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: o.bitrate,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
                AVVideoMaxKeyFrameIntervalKey: Int((fps * 2).rounded()),
                AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
                AVVideoAllowFrameReorderingKey: true,
            ],
        ]
        let i = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        i.expectsMediaDataInRealTime = false
        adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: i, sourcePixelBufferAttributes: attrs)
        w.add(i)
        w.startWriting()
        w.startSession(atSourceTime: .zero)
        writer = w; input = i
    }

    /// Bild in einen eigenen Puffer zeichnen (die Puffer des Lesers werden wiederverwendet)
    func render(_ img: CIImage) -> CVPixelBuffer {
        var dst: CVPixelBuffer? = nil
        CVPixelBufferPoolCreatePixelBuffer(nil, pool!, &dst)
        guard let target = dst else { fail("Kein Puffer") }
        ctx.render(img, to: target, bounds: CGRect(x: 0, y: 0, width: W, height: H), colorSpace: nil)
        return target
    }

    func emit(_ pb: CVPixelBuffer) async {
        let t = Double(written) * step
        while let s = stills.first, t + step * 0.5 >= s.0 {
            stills.removeFirst()
            let img = CIImage(cvPixelBuffer: pb)
            guard let cg = ctx.createCGImage(img, from: CGRect(x: 0, y: 0, width: W, height: H), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)) else { fail("Standbild fehlgeschlagen") }
            saveJPEG(cg, to: s.1, quality: o.quality)
            print("Standbild \(String(format: "%.2f", t)) s → \(s.1)")
        }
        if let input = input, let adaptor = adaptor {
            while !input.isReadyForMoreMediaData { try? await Task.sleep(nanoseconds: 2_000_000) }
            if !adaptor.append(pb, withPresentationTime: CMTime(seconds: t, preferredTimescale: 60000)) {
                fail("Schreiben fehlgeschlagen: \(String(describing: writer?.error))")
            }
        }
        written += 1
    }

    func finish() async {
        guard let w = writer, let i = input else { return }
        i.markAsFinished()
        await w.finishWriting()
        if w.status != .completed { fail("Schreiben fehlgeschlagen: \(String(describing: w.error))") }
        let bytes = (try? FileManager.default.attributesOfItem(atPath: o.output)[.size] as? Int) ?? 0
        print("\(o.output): \(written) Bilder, \(String(format: "%.2f", Double(written) * step)) s, \(W)x\(H), \(bytes / 1024) KB")
    }
}

func run(_ o: Options) async throws {
    // Bildrate des Ergebnisses: höchstens die der ersten Quelle (oder --fps)
    let first = AVURLAsset(url: URL(fileURLWithPath: o.segments[0].file))
    guard let t0 = try await first.loadTracks(withMediaType: .video).first else { fail("Keine Videospur") }
    let fps = min(o.fps ?? 60, Double(try await t0.load(.nominalFrameRate)))
    let enc = try Encoder(o, fps: fps)
    let fadeFrames = Int((o.xfade * fps).rounded())
    var held: [CVPixelBuffer] = [] // Ende des vorigen Abschnitts, wird mit dem Anfang des nächsten überblendet

    for (k, seg) in o.segments.enumerated() {
        let asset = AVURLAsset(url: URL(fileURLWithPath: seg.file))
        guard let track = try await asset.loadTracks(withMediaType: .video).first else { fail("Keine Videospur in \(seg.file)") }
        let natural = try await track.load(.naturalSize)
        let srcFps = Double(try await track.load(.nominalFrameRate))
        let duration = try await asset.load(.duration).seconds
        let end = min(seg.end, duration)
        let srcH = natural.height
        let crop = seg.crop ?? CGRect(origin: .zero, size: natural)
        if crop.maxX > natural.width + 0.5 || crop.maxY > natural.height + 0.5 || crop.minX < 0 || crop.minY < 0 {
            fail("Ausschnitt liegt außerhalb des Bildes \(Int(natural.width))x\(Int(natural.height)) in \(seg.file)")
        }
        let reader = try AVAssetReader(asset: asset)
        reader.timeRange = CMTimeRange(start: CMTime(seconds: max(0, seg.start - 0.1), preferredTimescale: 600),
                                       end: CMTime(seconds: min(duration, end + 0.1), preferredTimescale: 600))
        let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        out.alwaysCopiesSampleData = false
        reader.add(out)
        guard reader.startReading() else { fail("Lesen fehlgeschlagen: \(String(describing: reader.error))") }

        let scaleX = Double(enc.W) / crop.width, scaleY = Double(enc.H) / crop.height
        func frame(_ pb: CVPixelBuffer) -> CIImage {
            let ciY = srcH - crop.maxY // CoreImage zählt von unten
            let c = CIImage(cvPixelBuffer: pb)
                .cropped(to: CGRect(x: crop.minX, y: ciY, width: crop.width, height: crop.height))
                .transformed(by: CGAffineTransform(translationX: -crop.minX, y: -ciY))
            let f = CIFilter(name: "CILanczosScaleTransform")!
            f.setValue(c, forKey: kCIInputImageKey)
            f.setValue(scaleY, forKey: kCIInputScaleKey)
            f.setValue(scaleX / scaleY, forKey: kCIInputAspectRatioKey)
            var img = f.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: enc.W, height: enc.H))
            if o.mono {
                let m = CIFilter(name: "CIColorControls")!
                m.setValue(img, forKey: kCIInputImageKey)
                m.setValue(0, forKey: kCIInputSaturationKey)
                m.setValue(1.06, forKey: kCIInputContrastKey)
                img = m.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: enc.W, height: enc.H))
            }
            return img
        }

        var nextOut = seg.start
        var index = 0
        let isLast = k == o.segments.count - 1
        var tail: [CVPixelBuffer] = []
        while let sb = out.copyNextSampleBuffer() {
            guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
            let t = CMSampleBufferGetPresentationTimeStamp(sb).seconds
            if t + 0.5 / srcFps < seg.start { continue }
            if t > end { break }
            if t + 0.25 * enc.step * o.speed < nextOut { continue } // Bildrate begrenzen
            nextOut += enc.step * o.speed
            var img = frame(pb)
            if index < held.count { // Überblendung mit dem Ende des vorigen Abschnitts
                let f = CIFilter(name: "CIDissolveTransition")!
                f.setValue(CIImage(cvPixelBuffer: held[index]), forKey: kCIInputImageKey)
                f.setValue(img, forKey: kCIInputTargetImageKey)
                let x = Double(index + 1) / Double(held.count + 1)
                f.setValue(x * x * (3 - 2 * x), forKey: kCIInputTimeKey) // weich ein- und ausblenden
                img = f.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: enc.W, height: enc.H))
            }
            index += 1
            if !o.blur.isEmpty {
                // Zeit im fertigen Video: bereits geschriebene + gepufferte Bilder (Überblendungen vernachlässigt)
                let tOut = Double(enc.written + tail.count) * enc.step
                for box in blurBoxes(o.blur, at: tOut) {
                    let pad = 10.0
                    let r = CGRect(x: box.minX - pad, y: Double(enc.H) - box.maxY - pad, width: box.width + 2 * pad, height: box.height + 2 * pad)
                    let sigma = max(6, box.height * 0.22)
                    let soft = img.clampedToExtent().applyingGaussianBlur(sigma: sigma).cropped(to: img.extent)
                    let mask = CIImage(color: .white).cropped(to: r).applyingGaussianBlur(sigma: 4).cropped(to: img.extent)
                    img = soft.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: img, kCIInputMaskImageKey: mask])
                }
            }
            let rendered = enc.render(img)
            if isLast || fadeFrames == 0 {
                await enc.emit(rendered)
            } else {
                tail.append(rendered)
                if tail.count > fadeFrames { await enc.emit(tail.removeFirst()) }
            }
        }
        let readError = reader.status == .failed ? " (\(String(describing: reader.error)))" : ""
        reader.cancelReading()
        if index < held.count { fail("Abschnitt \(k + 1) ist kürzer als die Überblendung: \(index) Bilder\(readError)") }
        held = tail
        print("Abschnitt \(k + 1): \(seg.file) \(String(format: "%.2f", seg.start))–\(String(format: "%.2f", end)) s")
    }
    for pb in held { await enc.emit(pb) }
    await enc.finish()
}

let opts = parse()
let sema = DispatchSemaphore(value: 0)
Task {
    do { try await run(opts) } catch { fail("Fehler: \(error)") }
    sema.signal()
}
sema.wait()
