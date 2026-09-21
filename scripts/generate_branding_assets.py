import os
import io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import rembg

BRAIN_DIR = r"C:\Users\waleed Mohamd\.gemini\antigravity-ide\brain\7ba3cd62-42e4-4641-af76-ff6b889553b3"
OUTPUT_DIR = r"e:\ConvertX\public\branding_concepts"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def clean_and_center(img: Image.Image, target_size=(1024, 1024), padding=60) -> Image.Image:
    """Trim transparent borders and center on target_size square with specified padding."""
    # Find bounding box of non-zero alpha
    bbox = img.split()[-1].getbbox()
    if bbox:
        cropped = img.crop(bbox)
    else:
        cropped = img
    
    # Calculate scale factor to fit within target_size with padding
    avail_w = target_size[0] - padding * 2
    avail_h = target_size[1] - padding * 2
    
    scale = min(avail_w / cropped.width, avail_h / cropped.height)
    new_w = int(cropped.width * scale)
    new_h = int(cropped.height * scale)
    
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    paste_x = (target_size[0] - new_w) // 2
    paste_y = (target_size[1] - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas

def make_favicons(base_png: Image.Image, name: str):
    # Save standard favicon sizes: 32x32, 64x64, 192x192
    f32 = base_png.resize((32, 32), Image.Resampling.LANCZOS)
    f64 = base_png.resize((64, 64), Image.Resampling.LANCZOS)
    f192 = base_png.resize((192, 192), Image.Resampling.LANCZOS)
    
    f32.save(os.path.join(OUTPUT_DIR, f"{name}_favicon_32.png"))
    f64.save(os.path.join(OUTPUT_DIR, f"{name}_favicon_64.png"))
    f192.save(os.path.join(OUTPUT_DIR, f"{name}_icon_192.png"))
    
    # Also save as multi-size .ico
    f192.save(os.path.join(OUTPUT_DIR, f"{name}.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# --- Concept 1: 3D Crystal Origami X ---
img1_path = os.path.join(BRAIN_DIR, "logo_concept_origami_x_1790012338368.jpg")
if os.path.exists(img1_path):
    print("Processing Concept 1 (Origami X)...")
    orig1 = Image.open(img1_path).convert("RGB")
    nobg1 = rembg.remove(orig1)
    c1 = clean_and_center(nobg1, (1024, 1024), padding=70)
    c1.save(os.path.join(OUTPUT_DIR, "concept_1_origami_x.png"))
    make_favicons(c1, "concept_1")
    print("Concept 1 saved.")

# --- Concept 2: Dynamic Kinetic Arrows X ---
img2_path = os.path.join(BRAIN_DIR, "logo_arrows_x_1790012360743.jpg")
if os.path.exists(img2_path):
    print("Processing Concept 2 (Kinetic Arrows X)...")
    orig2 = Image.open(img2_path).convert("RGB")
    nobg2 = rembg.remove(orig2)
    c2 = clean_and_center(nobg2, (1024, 1024), padding=70)
    c2.save(os.path.join(OUTPUT_DIR, "concept_2_kinetic_arrows_x.png"))
    make_favicons(c2, "concept_2")
    print("Concept 2 saved.")

# --- Concept 3: Document Morph X ---
img3_path = os.path.join(BRAIN_DIR, "logo_doc_morph_x_1790012379456.jpg")
if os.path.exists(img3_path):
    print("Processing Concept 3 (Doc Morph X)...")
    orig3 = Image.open(img3_path).convert("RGB")
    nobg3 = rembg.remove(orig3)
    # Crop top 70% to get only the emblem (discarding the text 'ConvertX' for pure icon mark)
    w, h = nobg3.size
    emblem_crop = nobg3.crop((0, 0, w, int(h * 0.76)))
    c3 = clean_and_center(emblem_crop, (1024, 1024), padding=70)
    c3.save(os.path.join(OUTPUT_DIR, "concept_3_doc_morph_x.png"))
    make_favicons(c3, "concept_3")
    print("Concept 3 saved.")

# --- Concept 4: Cyber Hexagon Portal X ---
print("Rendering Concept 4 (Cyber Hexagon Portal X)...")
size = 1024
c4 = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw4 = ImageDraw.Draw(c4)

# Create an anti-aliased, ultra-modern cyber hexagon with conversion arrows
# We draw at 4x resolution (4096) and downsample
scale = 4
big_size = size * scale
big_img = Image.new("RGBA", (big_size, big_size), (0, 0, 0, 0))
big_draw = ImageDraw.Draw(big_img)

center = big_size // 2
radius = int(big_size * 0.44)

# Hexagon points
import math
hex_points = []
for i in range(6):
    angle = math.radians(60 * i - 30)
    hx = center + radius * math.cos(angle)
    hy = center + radius * math.sin(angle)
    hex_points.append((hx, hy))

# Draw sleek outer hexagon border with neon lime glow
lime = (132, 204, 22, 255)      # #84cc16
emerald = (16, 185, 129, 255)   # #10b981
cyan = (6, 182, 212, 255)       # #06b6d4
obsidian = (15, 23, 42, 240)    # dark slate

# Outer hexagon shield
big_draw.polygon(hex_points, fill=obsidian, outline=lime, width=int(14 * scale))

# Inner futuristic X made of dynamic conversion chevron arrows
x_radius = int(radius * 0.68)
w_beam = int(24 * scale)

# Diagonal 1: Top-Left to Bottom-Right (Lime to Emerald)
p_tl = (center - x_radius, center - x_radius)
p_br = (center + x_radius, center + x_radius)
big_draw.line([p_tl, p_br], fill=lime, width=w_beam)

# Diagonal 2: Bottom-Left to Top-Right (Cyan to Lime)
p_bl = (center - x_radius, center + x_radius)
p_tr = (center + x_radius, center - x_radius)
big_draw.line([p_bl, p_tr], fill=cyan, width=w_beam)

# Arrow heads at the 4 ends
def draw_arrow_head(cx, cy, angle_deg, color, arrow_len=int(40*scale), arrow_spread=int(30*scale)):
    rad = math.radians(angle_deg)
    tip = (cx, cy)
    left = (cx - arrow_len * math.cos(rad) + arrow_spread * math.sin(rad),
            cy - arrow_len * math.sin(rad) - arrow_spread * math.cos(rad))
    right = (cx - arrow_len * math.cos(rad) - arrow_spread * math.sin(rad),
             cy - arrow_len * math.sin(rad) + arrow_spread * math.cos(rad))
    big_draw.polygon([tip, left, right], fill=color)

draw_arrow_head(p_tr[0], p_tr[1], 45, cyan)
draw_arrow_head(p_bl[0], p_bl[1], 225, cyan)
draw_arrow_head(p_br[0], p_br[1], -45, lime)
draw_arrow_head(p_tl[0], p_tl[1], 135, lime)

# Center circular core glow
core_r = int(28 * scale)
big_draw.ellipse([center - core_r, center - core_r, center + core_r, center + core_r], fill=emerald, outline=lime, width=int(6*scale))

c4 = big_img.resize((size, size), Image.Resampling.LANCZOS)
c4.save(os.path.join(OUTPUT_DIR, "concept_4_cyber_portal_x.png"))
make_favicons(c4, "concept_4")
print("Concept 4 saved.")

# --- Concept 5: Minimalist Infinite Exchange X (Clean Vector Monogram) ---
print("Rendering Concept 5 (Minimalist Ribbon Exchange X)...")
big_img5 = Image.new("RGBA", (big_size, big_size), (0, 0, 0, 0))
big_draw5 = ImageDraw.Draw(big_img5)

# Two intersecting continuous curved ribbon paths that form a modern 'X'
# with gradient interpolation and round caps
span = int(big_size * 0.38)
thickness = int(68 * scale)

# Arc 1: Top-Left to Bottom-Right (Curved smoothly)
# Left half ribbon (electric lime #a3e635)
points_ribbon1 = []
for t_val in np.linspace(0, 1, 100):
    # Cubic Bezier curve
    x = (1-t_val)**3 * (center - span) + 3*(1-t_val)**2*t_val * (center - span*0.3) + 3*(1-t_val)*t_val**2 * (center + span*0.3) + t_val**3 * (center + span)
    y = (1-t_val)**3 * (center - span) + 3*(1-t_val)**2*t_val * (center - span*0.1) + 3*(1-t_val)*t_val**2 * (center + span*0.1) + t_val**3 * (center + span)
    points_ribbon1.append((x, y))

# Draw line segments with gradient from lime to emerald
for i in range(len(points_ribbon1) - 1):
    ratio = i / len(points_ribbon1)
    r = int(163 * (1 - ratio) + 16 * ratio)
    g = int(230 * (1 - ratio) + 185 * ratio)
    b = int(53 * (1 - ratio) + 129 * ratio)
    big_draw5.line([points_ribbon1[i], points_ribbon1[i+1]], fill=(r, g, b, 255), width=thickness)

# Arc 2: Bottom-Left to Top-Right (Crossing above)
points_ribbon2 = []
for t_val in np.linspace(0, 1, 100):
    x = (1-t_val)**3 * (center - span) + 3*(1-t_val)**2*t_val * (center - span*0.3) + 3*(1-t_val)*t_val**2 * (center + span*0.3) + t_val**3 * (center + span)
    y = (1-t_val)**3 * (center + span) + 3*(1-t_val)**2*t_val * (center + span*0.1) + 3*(1-t_val)*t_val**2 * (center - span*0.1) + t_val**3 * (center - span)
    points_ribbon2.append((x, y))

# Arrowheads on the ends
draw_arrow_head_5 = lambda cx, cy, angle, col: draw_arrow_head(cx, cy, angle, col, arrow_len=int(60*scale), arrow_spread=int(45*scale))

for i in range(len(points_ribbon2) - 1):
    ratio = i / len(points_ribbon2)
    r = int(6 * (1 - ratio) + 163 * ratio)
    g = int(182 * (1 - ratio) + 230 * ratio)
    b = int(212 * (1 - ratio) + 53 * ratio)
    big_draw5.line([points_ribbon2[i], points_ribbon2[i+1]], fill=(r, g, b, 255), width=thickness)

# Add arrow tips at ends of ribbon 1 and ribbon 2
draw_arrow_head_5(points_ribbon1[0][0], points_ribbon1[0][1], 225, (163, 230, 53, 255))
draw_arrow_head_5(points_ribbon1[-1][0], points_ribbon1[-1][1], 45, (16, 185, 129, 255))
draw_arrow_head_5(points_ribbon2[0][0], points_ribbon2[0][1], 135, (6, 182, 212, 255))
draw_arrow_head_5(points_ribbon2[-1][0], points_ribbon2[-1][1], -45, (163, 230, 53, 255))

c5 = big_img5.resize((size, size), Image.Resampling.LANCZOS)
c5.save(os.path.join(OUTPUT_DIR, "concept_5_minimalist_exchange_x.png"))
make_favicons(c5, "concept_5")
print("Concept 5 saved.")

print("All 5 branding concepts and favicons successfully generated!")
