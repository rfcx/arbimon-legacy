import math
import colorsys

spaces = ["rgb", "yiq", "hls", "hsv"]


def convert_spaces(cl, s1, s2):
    cl2 = [min(max(0, c), 1) for c in cl]
    if s1 == s2:
        return cl2
    elif s1 == "rgb":
        return getattr(colorsys, "rgb_to_%s" % s2)(*cl2)
    elif s2 == "rgb":
        return getattr(colorsys, "%s_to_rgb" % s1)(*cl2)
    else:
        rgb = getattr(colorsys, "%s_to_rgb" % s1)(*cl2)
        return getattr(colorsys, "rgb_to_%s" % s2)(*rgb)

for s1 in spaces:
    for s2 in spaces:
        exec (
            "def {s1}2{s2}(cl):\n" +
            "\t'Changes colors from {s1} to {s2}'\n" +
            "\treturn convert_spaces(cl, '{s1}', '{s2}')\n" +
            "\n"
        ).format(s1=s1, s2=s2)


def normalize(cl, scale=255.0):
    if type(scale) not in (list, tuple):
        scale = [scale] * len(cl)
    return [c / float(s) for c, s in zip(cl, scale)]


def quantize(cl, scale=255.0):
    return [int(c * scale) for c in cl]


def grad(p, colors):
    i = max(0, p * (len(colors)-1))
    f, c = map(int, [math.floor(i), math.ceil(i)])
    a = i - f
    return [(c1*(1-a) + c2*a) for (c1, c2) in zip(colors[f], colors[c])]


class AbstractGradient(object):
    def __init__(self):
        raise NotImplementedError()

    def __call__(self, i):
        raise NotImplementedError()

    def get_palette(self, color_count=256):
        d = color_count - 1.0
        return [self(i / d) for i in range(color_count)]


class LinearGradient(AbstractGradient):
    def __init__(self, colors, norm_scale=1.0, quant_scale=None, spacetx=None):
        self.colors = colors
        self.norm_scale = norm_scale
        self.quant_scale = quant_scale
        self.spacetx = spacetx if callable(spacetx) else (lambda x: x)
        self.grad = [normalize(cl, norm_scale) for cl in colors]

    def _grad_(self, p):
        colors = self.grad
        i = max(0, p * (len(colors)-1))
        f, c = map(int, [math.floor(i), math.ceil(i)])
        a = i - f
        cl = [(c1*(1-a) + c2*a) for (c1, c2) in zip(colors[f], colors[c])]
        print "  {0} color[{1}] : {2} * {3} + {4} * {5} = {6}".format(
            self.__class__.__name__, p, 1-a, colors[f], a, colors[c], cl
        )
        return cl

    def __call__(self, i):
        cl = self.spacetx(self._grad_(i))
        print "    - ", cl
        return quantize(cl, self.quant_scale) if self.quant_scale else cl


class MultiGradient(AbstractGradient):
    def __init__(self, gradients, quant_scale=None):
        self.gradients = gradients
        self.quant_scale = quant_scale

    def __call__(self, i):
        c = len(self.gradients)
        j = i * c
        q = min(math.floor(j), c-1)
        cl = self.gradients[int(q)](j-q)
        print "{0} color[{1}] : {2}, {3}, {4}, {5}, {6}".format(
            self.__class__.__name__, i, c, j, q, cl, j-q
        )
        return quantize(cl, self.quant_scale) if self.quant_scale else cl


if __name__ == "__main__":
    for r in range(256):
        for g in range(256):
            for b in range(256):
                rgb = (r, g, b)
                hsv = rgb2hsv(rgb)
                rgb2 = hsv2rgb(hsv)
                print "rgb : %r, hsv : %r, rgb2: %r" % (rgb, hsv, rgb2)
