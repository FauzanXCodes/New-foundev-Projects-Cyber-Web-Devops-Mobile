// Rally's water. Every effect here is a SwiftUI shader: SwiftUI hands each pixel to Metal on the GPU,
// so the motion costs the CPU nothing and stays smooth at 120 Hz on ProMotion screens.

#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// A ring of water spreading out from where a finger touched. Used as a layer effect on every
// pressable thing: buttons, chips, cards, tabs.
[[ stitchable ]] half4 ripple(float2 position, SwiftUI::Layer layer, float2 origin, float time,
                              float amplitude, float frequency, float decay, float speed) {
    float dist = length(position - origin);
    float t = max(0.0, time - dist / speed);
    float wave = amplitude * sin(frequency * t) * exp(-decay * t);
    float2 dir = dist > 0.001 ? (position - origin) / dist : float2(0.0);
    half4 color = layer.sample(position + wave * dir);
    // A little light where the crest lifts, a little shade in the trough, like real water.
    color.rgb += half(0.25 * wave / max(amplitude, 0.001)) * color.a;
    return color;
}

// A progress bar filled with liquid. The leading edge is a water surface that sways, sloshes harder
// right after the level changes, and a soft sheen drifts through the fill.
[[ stitchable ]] half4 liquidBar(float2 position, half4 color, float2 size, float fraction, float time,
                                 float slosh, half4 fill, half4 track) {
    float y = position.y / max(size.y, 1.0);
    float sway = sin(y * 6.2831 + time * 3.2) * 0.6 + sin(y * 12.566 - time * 5.1) * 0.4;
    float edge = fraction * size.x + sway * (1.2 + slosh * 7.0) * min(fraction * 8.0, 1.0);
    if (fraction >= 0.999) edge = size.x + 20.0;
    if (fraction <= 0.001) edge = -20.0;
    float inside = smoothstep(edge + 0.8, edge - 0.8, position.x);
    float sheen = pow(max(0.0, sin((position.x - time * 70.0) / max(size.x, 1.0) * 6.2831 * 1.3 + y * 1.5)), 10.0) * 0.18;
    half4 liquid = fill;
    liquid.rgb += half(sheen) * liquid.a;
    return mix(track, liquid, half(inside)) * color.a;
}

// A circle filling with water from the bottom: the level rises, the surface waves.
[[ stitchable ]] half4 waterLevel(float2 position, half4 color, float2 size, float level, float time,
                                  half4 water, half4 empty) {
    float x = position.x / max(size.x, 1.0);
    float surface = (1.0 - level) * size.y
        + sin(x * 9.0 + time * 4.0) * 4.0 * (1.0 - level * 0.6)
        + sin(x * 17.0 - time * 6.0) * 1.8;
    float under = smoothstep(surface - 1.0, surface + 1.0, position.y);
    float depth = clamp((position.y - surface) / max(size.y, 1.0), 0.0, 1.0);
    half4 w = water;
    w.rgb *= half(1.0 - depth * 0.25);
    return mix(empty, w, half(under)) * color.a;
}

// Light on the bottom of a pool: bright, wandering lines. Drawn faintly across the top of a screen.
[[ stitchable ]] half4 caustics(float2 position, half4 color, float2 size, float time, half4 tint, float strength) {
    float2 p = position / max(size.x, 1.0) * 5.0;
    float t = time * 0.35;
    float v = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        p += float2(sin(p.y * 1.3 + t * (1.0 + fi * 0.25) + fi), cos(p.x * 1.1 - t * (0.8 + fi * 0.2) + fi * 1.7)) * 0.42;
        v += sin(p.x + p.y + t);
    }
    float lines = pow(1.0 - abs(sin(v * 0.9)), 7.0);
    float fade = smoothstep(size.y * 0.75, 0.0, position.y);
    float a = lines * strength * fade;
    return half4(color.rgb * (1.0h - half(a)) + tint.rgb * half(a), color.a);
}

// Content that has just landed settles like a reflection on water: a wave that dies away.
[[ stitchable ]] float2 settle(float2 position, float2 size, float time, float amount) {
    float a = amount * exp(-time * 4.5);
    return position + float2(sin(position.y / 16.0 + time * 11.0) * a,
                             sin(position.x / 22.0 + time * 9.0) * a * 0.5);
}

// ---------- backdrop candidates (preview only) ----------

// Sole: the chevron tread of a running shoe, pressed into the page. It is nearly invisible until a
// footfall lands, and then the tread lights up in a ring that spreads and fades.
[[ stitchable ]] half4 sole(float2 position, half4 color, float2 size, float time, half4 tint, float strength) {
    float w = max(size.x, 1.0);
    float2 u = position / 30.0;
    float zig = abs(fract(u.x) - 0.5);
    float v = fract(u.y * 0.85 + zig * 1.5 - time * 0.02);
    float bar = smoothstep(0.28, 0.33, v) * smoothstep(0.72, 0.67, v);
    float press = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float beat = time * 0.16 + fi * 0.37;
        float phase = fract(beat);
        float step = floor(beat);
        // Each footfall lands somewhere new, alternating left and right like a stride.
        float side = fmod(step + fi, 2.0);
        float2 c = float2(w * (0.28 + 0.44 * side), w * (0.25 + 0.55 * fract(sin(step * 12.9 + fi * 4.1) * 43758.5)));
        float r = length(position - c);
        float ring = exp(-pow((r - phase * w * 0.85) / (w * 0.11), 2.0));
        press += ring * (1.0 - phase) * (1.0 - phase);
    }
    float fade = smoothstep(size.y * 0.72, 0.0, position.y);
    float a = clamp(bar * (0.10 + press * 0.9) * fade * strength, 0.0, 1.0);
    return half4(color.rgb * (1.0h - half(a)) + tint.rgb * half(a), color.a);
}
