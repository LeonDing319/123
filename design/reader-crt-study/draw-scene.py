"""Render the original low-resolution study for the Reader visual prototype."""
import random
from pathlib import Path

from PIL import Image, ImageDraw

WIDTH, HEIGHT = 300, 164
image = Image.new("RGB", (WIDTH, HEIGHT), "#303a26")
ink = ImageDraw.Draw(image)
randomizer = random.Random(17)

def box(color, x, y, width, height):
    ink.rectangle((x, y, x + width - 1, y + height - 1), fill=color)

def shape(color, *points):
    ink.polygon(points, fill=color)

shape("#161e16", (0, 0), (299, 0), (253, 17), (54, 21))
shape("#20291b", (0, 0), (54, 21), (54, 113), (0, 163))
shape("#1f2919", (299, 0), (253, 17), (253, 109), (299, 144))
shape("#414932", (0, 163), (54, 113), (253, 109), (299, 144), (299, 163))
shape("#566046", (54, 105), (253, 101), (253, 110), (54, 115))
shape("#171f16", (54, 108), (253, 103), (253, 108), (54, 113))
for x in range(18, 280, 30):
    ink.line((x, 163, 58 + (x - 50) // 2, 114), fill="#303824")
for y in (125, 142, 159):
    ink.line((0, y + 6, 299, y - 3), fill="#313a29")
shape("#2a3222", (4, 58), (49, 69), (49, 106), (4, 143))
ink.line((3, 61, 51, 72), fill="#3d4730", width=2)

box("#141d13", 74, 23, 70, 99)
box("#60664a", 77, 25, 63, 95)
box("#343f2b", 80, 28, 57, 88)
box("#8b8661", 83, 29, 50, 1)
for py, height in ((35, 32), (76, 31)):
    box("#536044", 86, py, 44, height)
    box("#252f21", 88, py + 2, 40, height - 4)
    box("#303b29", 90, py + 4, 36, height - 8)
    box("#62684b", 87, py + height - 2, 42, 1)
box("#252f1e", 118, 67, 8, 8)
box("#a7a26a", 119, 68, 7, 4)
box("#c3bb7b", 122, 68, 8, 2)
box("#686d51", 79, 116, 61, 4)

box("#1a2418", 167, 29, 66, 72)
box("#515b40", 169, 30, 61, 3)
box("#64704c", 169, 34, 3, 61)
box("#434b34", 226, 34, 4, 61)
for y in (52, 71, 90):
    for x in range(174, 223, 5):
        h = randomizer.randrange(7, 17)
        color = randomizer.choice(["#758057", "#586b4b", "#9e9064", "#495b3e", "#394a32"])
        box(color, x, y - h, randomizer.choice([3, 4]), h)
        if h > 10:
            box("#adb084", x, y - 4, 2, 1)
    box("#626b49", 172, y, 54, 2)
    box("#262f21", 172, y + 2, 54, 2)

shape("#505944", (60, 130), (139, 125), (164, 147), (28, 155))
shape("#777450", (63, 131), (138, 126), (159, 145), (35, 153))
shape("#454d36", (66, 133), (137, 129), (152, 143), (45, 150))
shape("#1d281c", (157, 128), (253, 111), (289, 139), (221, 155))
shape("#666447", (158, 96), (226, 89), (267, 110), (192, 123))
shape("#8b8661", (161, 97), (226, 91), (263, 109), (193, 121))
shape("#474b32", (192, 122), (267, 110), (267, 115), (192, 129))
shape("#2e3625", (192, 128), (198, 127), (199, 150), (194, 151))
shape("#303824", (258, 118), (264, 116), (266, 142), (260, 143))
shape("#5c5b3c", (204, 104), (218, 101), (230, 108), (214, 113))
shape("#d7cb8b", (205, 102), (218, 99), (228, 107), (214, 110))
ink.line((211, 103, 218, 102), fill="#746748")
ink.line((214, 106, 221, 104), fill="#9e8757")

for _ in range(780):
    x = randomizer.randrange(WIDTH)
    y = randomizer.randrange(5, HEIGHT)
    if image.getpixel((x, y)) in {(48, 58, 38), (65, 73, 50), (32, 41, 27), (31, 41, 25)}:
        ink.point((x, y), fill=randomizer.choice(["#3a462f", "#343f2b", "#4b543a"]))

image.save(Path(__file__).with_name("study-camera.png"))
