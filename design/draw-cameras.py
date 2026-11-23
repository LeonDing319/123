"""Build six looping, limited-palette views from the fixed security cameras."""
from pathlib import Path
from PIL import Image, ImageDraw
import random

out = Path(__file__).resolve().parents[1] / "public" / "cameras"
out.mkdir(parents=True, exist_ok=True)
colors = ["#101b19","#1b2c24","#293c30","#364b39","#465c43","#5b7251","#728764","#8e9e77","#abb48b","#ced1a3"]
for scene in range(1, 7):
    frames = []
    for tick in range(4):
        rng = random.Random(17 + scene)
        im = Image.new("RGB",(320,176),colors[2])
        d = ImageDraw.Draw(im)
        def box(x,y,w,h,c): d.rectangle((x,y,x+w-1,y+h-1),fill=colors[c])
        def poly(pts,c): d.polygon(pts,fill=colors[c])
        def line(pts,c): d.line(pts,fill=colors[c])
        # Back wall, floor tiles and ceiling light wells share a single vanishing point.
        poly([(0,0),(77,27),(254,27),(320,0)],2)
        poly([(77,27),(254,27),(254,99),(77,99)],4)
        poly([(0,0),(77,27),(77,99),(0,150)],3)
        poly([(320,0),(254,27),(254,99),(320,150)],2)
        poly([(0,150),(77,99),(254,99),(320,150),(320,176),(0,176)],4)
        for x in range(-360,701,60): line([(158+(x-158)//6,99),(x,176)],3)
        for y in (105,115,130,154):line([(0,y),(320,y)],3)
        for y in (29,95,98):line([(77,y),(254,y)],2)
        for x in (119,159,198,236):line([(x,29),(x,94)],3)
        for x in (108,178):poly([(x,14),(x+39,14),(x+33,18),(x+6,18)],7)
        # Metal door frame and inset observation pane.
        bx=202 if scene!=6 else 169
        box(bx,41,31,58,1);box(bx+2,43,27,55,3);box(bx+7,49,15,14,1);box(bx+8,50,13,10,5);box(bx+22,72,3,2,7)
        def cabinet(x,y,w,h):
            box(x+3,y+2,w,h,1);box(x,y,w,h,4);line([(x,y+h-1),(x,y),(x+w-1,y)],6)
            for cy in range(y+3,y+h-9,12):
                box(x+2,cy,w-4,10,3);line([(x+3,cy),(x+w-4,cy)],5);box(x+w//2-3,cy+3,7,2,7)
        def desk(x,y):
            poly([(x,y),(x+48,y),(x+62,y+8),(x+7,y+8)],6);box(x+7,y+9,55,4,2)
            box(x+8,y+13,3,18,1);box(x+56,y+13,3,18,1)
        if scene in (1,5):
            for x in (80,106,132):cabinet(x,44,24,53)
            for x in (9,38):cabinet(x,57,27,68)
            desk(108,111)
            for i in range(4):box(127+i*2,112+i,11,2,8)
            if scene==5:
                for x,y in [(181,113),(199,127),(177,101)]: box(x,y,20,13,3);box(x,y,20,2,6);box(x+8,y+2,3,8,5)
        elif scene in (2,4):
            for x in (95,135):box(x,42,23,55,1);box(x+2,44,19,52,3);box(x+5,48,13,14,5)
            if scene==2:
                for j in range(6):box(6+j*4,145-j*6,46,4,5)
        else:
            desk(94,84);box(106,65,28,18,1);box(108,67,24,13,5);box(117,83,5,4,2)
            if scene==3:box(145,40,45,28,1);box(147,42,41,24,3);desk(12,116)
            else:desk(54,111);cabinet(235,51,17,45)
        # Human silhouette, with a two-pixel arm movement on the monitor loop.
        x,y=[(153,96),(133,109),(139,99),(154,106),(142,98),(155,102)][scene-1]
        poly([(x-6,y+29),(x+6,y+30),(x+22,y+34),(x+6,y+34)],3)
        box(x-4,y-2,8,8,1);box(x+2,y,3,4,5)
        poly([(x-4,y+5),(x+3,y+5),(x+7,y+20),(x-7,y+20)],1);box(x-4,y+20,3,10,1);box(x+2,y+20,3,11,1)
        line([(x+3,y+8),(x+7,y+12),(x+10,y+10+(tick//2))],5)
        for _ in range(240): 
            xx,yy=rng.randrange(320),rng.randrange(176)
            if yy>100:d.point((xx,yy),fill=colors[3])
        frames.append(im)
    frames[0].save(out/f"s{scene:02}.gif",save_all=True,append_images=frames[1:],duration=440,loop=0,optimize=False)
