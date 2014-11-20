from a2pyutils import colors

palette = colors.MultiGradient([
    colors.LinearGradient(
        [[43/60.0, 1.0, .9], [31/60.0, 1.0, .9]], spacetx=colors.hsv2rgb
    ),
    colors.LinearGradient(
        [[23/60.0, 1.0, .9], [11/60.0, 1.0, .9]], spacetx=colors.hsv2rgb
    ),
    colors.LinearGradient(
        [[10/60.0, 1.0, .9], [6/60.00, 0.3, .9]], spacetx=colors.hsv2rgb
    ),
    colors.LinearGradient(
        [[0x90, 0x61, 0x24], [0xea, 0xca, 0xb9]], norm_scale=255.0
    )
], 255).get_palette(256)

def get_palette():
    return palette;
