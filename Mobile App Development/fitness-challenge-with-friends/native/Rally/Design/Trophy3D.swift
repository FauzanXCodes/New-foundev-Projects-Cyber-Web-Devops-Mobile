import RealityKit
import SwiftUI

/**
 * A gold trophy in real 3D (RealityKit), built from simple shapes so it needs no model file. It drops
 * in, settles, and turns slowly. With Reduce Motion it simply stands still.
 */
struct Trophy3D: View {
    var height: CGFloat = 170
    /** Called once the 3D scene is built and on screen. RealityKit's first start can stall the app briefly, so anything meant to play alongside the trophy should wait for this. */
    var onReady: () -> Void = {}
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var ready = false
    @State private var arrived = false

    var body: some View {
        // RealityKit's first start stalls the app for a moment (seconds in the Simulator). So the page gets
        // to finish arriving first, with a flat trophy standing in, and only then is the 3D one built.
        ZStack {
            if ready { scene.transition(.liquid) }
            if !arrived {
                Image(systemName: "trophy.fill")
                    .font(.system(size: height * 0.42))
                    .foregroundStyle(LinearGradient(colors: [Color(red: 1, green: 0.84, blue: 0.36), Color(red: 0.85, green: 0.58, blue: 0.12)], startPoint: .top, endPoint: .bottom))
                    .symbolEffect(.pulse, options: .repeating)
                    .transition(.liquid)
            }
        }
        .frame(height: height)
        .task {
            try? await Task.sleep(for: .milliseconds(2600))
            ready = true
        }
        .accessibilityElement()
        .accessibilityLabel("Trophy")
    }

    private var scene: some View {
        RealityView { content in
            content.camera = .virtual

            let trophy = Self.makeTrophy()
            trophy.scale = reduce ? [1, 1, 1] : [0.01, 0.01, 0.01]
            trophy.position = reduce ? .zero : [0, 0.12, 0]
            content.add(trophy)

            let camera = PerspectiveCamera()
            camera.camera.fieldOfViewInDegrees = 34
            camera.look(at: [0, 0.085, 0], from: [0, 0.15, 0.36], relativeTo: nil)
            content.add(camera)

            let key = DirectionalLight()
            key.light.intensity = 4200
            key.look(at: [0, 0.08, 0], from: [0.35, 0.5, 0.45], relativeTo: nil)
            content.add(key)

            let fill = PointLight()
            fill.light.intensity = 9000
            fill.light.attenuationRadius = 2
            fill.position = [-0.25, 0.15, 0.3]
            content.add(fill)

            let rim = PointLight()
            rim.light.intensity = 6000
            rim.light.color = UIColor(Palette.accent)
            rim.position = [0.1, 0.25, -0.3]
            content.add(rim)

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                withAnimation(Motion.wave) { arrived = true }
                onReady()
            }
            guard !reduce else { return }
            // Drop in from above, overshoot a little, then turn forever.
            var landed = trophy.transform
            landed.scale = [1, 1, 1]
            landed.translation = .zero
            trophy.move(to: landed, relativeTo: trophy.parent, duration: 0.9, timingFunction: .easeOut)

            let spin = OrbitAnimation(
                duration: 7, axis: [0, 1, 0], startTransform: Transform(), spinClockwise: false,
                orientToPath: true, bindTarget: .transform, repeatMode: .repeat)
            if let resource = try? AnimationResource.generate(with: spin), let child = trophy.children.first {
                child.playAnimation(resource)
            }
        }
    }

    /** Base, stem, cup and rim, stacked. The spinning happens on an inner node so the drop-in can move the outer one. */
    private static func makeTrophy() -> Entity {
        let outer = Entity()
        let inner = Entity()
        outer.addChild(inner)

        var gold = PhysicallyBasedMaterial()
        gold.baseColor = .init(tint: UIColor(red: 1.0, green: 0.77, blue: 0.27, alpha: 1))
        gold.metallic = 0.75
        gold.roughness = 0.22
        gold.clearcoat = .init(floatLiteral: 0.6)

        var stone = PhysicallyBasedMaterial()
        stone.baseColor = .init(tint: UIColor(white: 0.12, alpha: 1))
        stone.roughness = 0.45

        func add(_ mesh: MeshResource, _ material: PhysicallyBasedMaterial, y: Float, flip: Bool = false) {
            let e = ModelEntity(mesh: mesh, materials: [material])
            e.position = [0, y, 0]
            if flip { e.orientation = simd_quatf(angle: .pi, axis: [1, 0, 0]) }
            inner.addChild(e)
        }

        add(.generateBox(width: 0.1, height: 0.024, depth: 0.1, cornerRadius: 0.006), stone, y: 0.012)
        add(.generateBox(width: 0.068, height: 0.018, depth: 0.068, cornerRadius: 0.004), gold, y: 0.033)
        add(.generateCylinder(height: 0.04, radius: 0.0075), gold, y: 0.062)
        add(.generateSphere(radius: 0.013), gold, y: 0.084)
        add(.generateCone(height: 0.075, radius: 0.043), gold, y: 0.127, flip: true)
        add(.generateCylinder(height: 0.006, radius: 0.0445), gold, y: 0.165)
        // Handles: two small rings of spheres either side of the cup.
        for side: Float in [-1, 1] {
            for i in 0..<24 {
                let a = Float(i) / 23 * .pi
                let e = ModelEntity(mesh: .generateSphere(radius: 0.004), materials: [gold])
                e.position = [side * (0.042 + sin(a) * 0.017), 0.118 + cos(a) * 0.024, 0]
                inner.addChild(e)
            }
        }
        return outer
    }
}
