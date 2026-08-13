"""Generate ARTSA favicon set (16/32 PNG + 180 apple-icon) from the brand shield.

Renders the shield geometry with anti-aliasing via supersampling, matching the
gradients used in frontend/components/shared/Logo.tsx and public/favicon.svg.
"""
import os
import sys

from PIL import Image, ImageDraw

SIZE = 180
SCALE = 4  # supersample factor for anti-aliasing


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def make_gradient(c1, c2, size):
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / (size - 1) if size > 1 else 0
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        gd.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return grad


def draw_icon(size, *, with_padding=True):
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # Shield geometry (shield spans ~90% of the canvas with padding)
    pad = s * (0.06 if with_padding else 0.0)
    outer = [
        (s / 2, pad),
        (s * 0.14, s * 0.235),
        (s * 0.14, s * 0.52),
        (s / 2, s * 0.93),
        (s * 0.86, s * 0.52),
        (s * 0.86, s * 0.235),
    ]
    inner = [
        (s / 2, s * 0.065),
        (s * 0.19, s * 0.26),
        (s * 0.19, s * 0.51),
        (s / 2, s * 0.885),
        (s * 0.81, s * 0.51),
        (s * 0.81, s * 0.26),
    ]

    # Stroke: outer shield in blue gradient
    stroke_grad = make_gradient(hex2rgb("#3B66F0"), hex2rgb("#2B8FD4"), s)
    stroke_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(stroke_mask).polygon(outer, fill=255)
    img = Image.alpha_composite(
        img,
        Image.composite(stroke_grad, Image.new("RGBA", (s, s), (0, 0, 0, 0)), stroke_mask),
    )

    # Fill: inner shield in dark navy gradient
    fill_grad = make_gradient(hex2rgb("#0B1530"), hex2rgb("#0F1F45"), s)
    fill_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(fill_mask).polygon(inner, fill=255)
    img = Image.alpha_composite(
        img,
        Image.composite(fill_grad, Image.new("RGBA", (s, s), (0, 0, 0, 0)), fill_mask),
    )

    # Chevron "A"
    chevron = [
        (s / 2, s * 0.3),
        (s * 0.29, s * 0.64),
        (s * 0.4, s * 0.64),
        (s / 2, s * 0.47),
        (s * 0.6, s * 0.64),
        (s * 0.71, s * 0.64),
    ]
    fg_grad = make_gradient(hex2rgb("#6B93F7"), hex2rgb("#47A8E5"), s)
    fg_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(fg_mask).polygon(chevron, fill=255)
    img = Image.alpha_composite(
        img,
        Image.composite(fg_grad, Image.new("RGBA", (s, s), (0, 0, 0, 0)), fg_mask),
    )

    # Scanline under chevron
    draw = ImageDraw.Draw(img)
    draw.line(
        [(s * 0.375, s * 0.765), (s * 0.625, s * 0.765)],
        fill=hex2rgb("#47A8E5") + (179,),
        width=int(s * 0.04),
    )

    # Accent dots
    draw.ellipse(
        [s / 2 - s * 0.028, s * 0.195, s / 2 + s * 0.028, s * 0.25],
        fill=hex2rgb("#8BA1F7") + (153,),
    )
    draw.ellipse(
        [s * 0.39 - s * 0.017, s * 0.225, s * 0.39 + s * 0.017, s * 0.258],
        fill=hex2rgb("#8BA1F7") + (89,),
    )
    draw.ellipse(
        [s * 0.61 - s * 0.017, s * 0.225, s * 0.61 + s * 0.017, s * 0.258],
        fill=hex2rgb("#8BA1F7") + (89,),
    )

    # Downscale for anti-aliasing
    return img.resize((size, size), Image.LANCZOS)


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(outdir, exist_ok=True)

    # 180x180 apple-touch-icon (full bleed, no padding — Apple rounds it)
    draw_icon(180, with_padding=False).save(os.path.join(outdir, "apple-icon.png"))
    # 32px favicon
    draw_icon(32).save(os.path.join(outdir, "favicon-32x32.png"))
    # 16px favicon
    draw_icon(16).save(os.path.join(outdir, "favicon-16x16.png"))

    print(f"Generated favicon set in {outdir}")


if __name__ == "__main__":
    main()
