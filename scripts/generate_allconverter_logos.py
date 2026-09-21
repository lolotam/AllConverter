import os
import subprocess
from PIL import Image

OUTPUT_DIR = r"e:\ConvertX\public\branding_allconverter"
BRAIN_DIR = r"C:\Users\waleed Mohamd\.gemini\antigravity-ide\brain\7ba3cd62-42e4-4641-af76-ff6b889553b3"
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(BRAIN_DIR, exist_ok=True)

# -------------------------------------------------------------
# SVG DEFINITIONS (1024 x 1024, 1:1, Transparent Background)
# -------------------------------------------------------------

# Concept 1: Universal Infinity Loop (All-to-All Conversion)
SVG_1 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="grad1_lime_emerald" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bef264" />
      <stop offset="50%" stop-color="#84cc16" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <linearGradient id="grad1_emerald_cyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="grad1_cyan_lime" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#84cc16" />
    </linearGradient>
    <filter id="glow1" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#84cc16" flood-opacity="0.35" />
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.25" />
    </filter>
    <filter id="shadow_under" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#052e16" flood-opacity="0.6" />
    </filter>
  </defs>

  <g filter="url(#glow1)">
    <!-- Back Loop Segment (Emerald to Cyan) -->
    <path d="M 512,512 C 600,620 720,680 820,680 C 930,680 1000,590 1000,480 C 1000,370 910,290 800,290 C 690,290 590,380 512,512 Z"
          fill="none" stroke="url(#grad1_emerald_cyan)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Overlap Shadow -->
    <path d="M 512,512 C 430,410 330,340 224,340 C 120,340 40,420 40,512 C 40,610 120,684 224,684 C 330,684 430,600 512,512"
          fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="96" stroke-linecap="round" filter="url(#shadow_under)" />

    <!-- Front Loop Segment (Lime to Emerald) -->
    <path d="M 512,512 C 430,410 330,340 224,340 C 120,340 40,420 40,512 C 40,610 120,684 224,684 C 330,684 430,600 512,512 Z"
          fill="none" stroke="url(#grad1_lime_emerald)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Forward Conversion Arrow Top-Right -->
    <polygon points="870,220 950,330 820,340" fill="#a3e635" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))" />

    <!-- Return Conversion Arrow Bottom-Left -->
    <polygon points="154,800 74,690 204,680" fill="#38bdf8" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))" />

    <!-- Central Glowing Conversion Nexus Core -->
    <circle cx="512" cy="512" r="32" fill="#ffffff" filter="drop-shadow(0 0 16px #a3e635)" />
    <circle cx="512" cy="512" r="18" fill="#84cc16" />
  </g>
</svg>'''

# Concept 2: The Interlocking "AC" Tech Monogram (AllConverter Tech)
SVG_2 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="grad2_a" x1="0%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#15803d" />
      <stop offset="40%" stop-color="#84cc16" />
      <stop offset="100%" stop-color="#bef264" />
    </linearGradient>
    <linearGradient id="grad2_c" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <linearGradient id="grad2_arrow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#bef264" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <filter id="glow2" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#84cc16" flood-opacity="0.3" />
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#06b6d4" flood-opacity="0.2" />
    </filter>
  </defs>

  <g filter="url(#glow2)">
    <!-- The "C" Orbit Ring with Integrated Arrow -->
    <path d="M 620,200 C 360,180 140,320 140,540 C 140,760 350,880 620,860 C 760,850 870,760 900,660"
          fill="none" stroke="url(#grad2_c)" stroke-width="84" stroke-linecap="round" />
    
    <!-- "C" Arrowhead pointing at apex -->
    <polygon points="620,120 740,210 610,280" fill="#38bdf8" />

    <!-- The "A" Delta Arrow / Monogram -->
    <!-- Left Leg -->
    <path d="M 280,840 L 512,240 L 744,840" 
          fill="none" stroke="url(#grad2_a)" stroke-width="88" stroke-linecap="round" stroke-linejoin="round" />

    <!-- "A" Horizontal Tech Bridge (Conversion Bar) -->
    <path d="M 370,620 L 654,620" 
          fill="none" stroke="#ffffff" stroke-width="48" stroke-linecap="round" />
    
    <!-- Conversion Arrow on Bridge -->
    <polygon points="690,620 620,580 620,660" fill="#84cc16" />

    <!-- Apex Delta Glow -->
    <polygon points="512,140 590,260 434,260" fill="url(#grad2_arrow)" filter="drop-shadow(0 4px 12px rgba(132,204,22,0.6))" />
  </g>
</svg>'''

# Concept 3: The 360° Universal Tri-Orbit (All Formats Cycle)
SVG_3 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="grad3_1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bef264" />
      <stop offset="100%" stop-color="#84cc16" />
    </linearGradient>
    <linearGradient id="grad3_2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#84cc16" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <linearGradient id="grad3_3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="glow3" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#84cc16" flood-opacity="0.3" />
    </filter>
  </defs>

  <g filter="url(#glow3)" transform="translate(512, 512)">
    <!-- Branch 1 (Top Right) -->
    <g transform="rotate(0)">
      <path d="M 0,-340 A 340 340 0 0 1 294,-170" fill="none" stroke="url(#grad3_1)" stroke-width="82" stroke-linecap="round" />
      <polygon points="320,-110 350,-240 230,-190" fill="#a3e635" />
    </g>

    <!-- Branch 2 (Bottom Right) -->
    <g transform="rotate(120)">
      <path d="M 0,-340 A 340 340 0 0 1 294,-170" fill="none" stroke="url(#grad3_2)" stroke-width="82" stroke-linecap="round" />
      <polygon points="320,-110 350,-240 230,-190" fill="#10b981" />
    </g>

    <!-- Branch 3 (Bottom Left) -->
    <g transform="rotate(240)">
      <path d="M 0,-340 A 340 340 0 0 1 294,-170" fill="none" stroke="url(#grad3_3)" stroke-width="82" stroke-linecap="round" />
      <polygon points="320,-110 350,-240 230,-190" fill="#06b6d4" />
    </g>

    <!-- Center Tech Core Emblem: Stylized Document with Folded Corner -->
    <g transform="translate(-80, -100)">
      <path d="M 0,0 L 110,0 L 160,50 L 160,200 L 0,200 Z" fill="#0f172a" stroke="#84cc16" stroke-width="14" stroke-linejoin="round" />
      <path d="M 110,0 L 110,50 L 160,50" fill="#84cc16" stroke="#84cc16" stroke-width="10" stroke-linejoin="round" />
      <!-- Horizontal Data Sparks -->
      <line x1="30" y1="90" x2="130" y2="90" stroke="#bef264" stroke-width="12" stroke-linecap="round" />
      <line x1="30" y1="130" x2="110" y2="130" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" />
    </g>
  </g>
</svg>'''

# Concept 4: The Delta-Tech Supersonic "A" Converter
SVG_4 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="grad4_body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bef264" />
      <stop offset="50%" stop-color="#84cc16" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="grad4_cyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="glow4" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#84cc16" flood-opacity="0.35" />
    </filter>
  </defs>

  <g filter="url(#glow4)">
    <!-- Outer Delta Wing / 'A' -->
    <path d="M 512,120 L 880,780 C 900,820 870,860 820,860 L 670,860 L 512,560 L 354,860 L 204,860 C 154,860 124,820 144,780 Z"
          fill="url(#grad4_body)" />

    <!-- Inner Aerodynamic Negative Cutout forming Arrow -->
    <path d="M 512,280 L 640,540 L 384,540 Z" fill="#0f172a" fill-opacity="0.92" />

    <!-- Dual Conversion Chevron in the Belly -->
    <!-- Left to Right conversion arrow -->
    <path d="M 330,690 L 470,690 M 440,650 L 480,690 L 440,730" 
          fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Right to Left conversion arrow -->
    <path d="M 694,760 L 554,760 M 584,720 L 544,760 L 584,800" 
          fill="none" stroke="url(#grad4_cyan)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Supersonic Apex Flare -->
    <circle cx="512" cy="130" r="24" fill="#ffffff" filter="drop-shadow(0 0 12px #bef264)" />
  </g>
</svg>'''

# Concept 5: The "All-Formats" Hexa-Core Cube (Isometric Dimension)
SVG_5 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="grad5_top" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#84cc16" />
      <stop offset="100%" stop-color="#bef264" />
    </linearGradient>
    <linearGradient id="grad5_left" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="grad5_right" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="glow5" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="30" flood-color="#84cc16" flood-opacity="0.35" />
    </filter>
  </defs>

  <g filter="url(#glow5)" transform="translate(512, 512)">
    <!-- Top Face (Isometric Diamond) -->
    <polygon points="0,-360 312,-180 0,0 -312,-180" fill="url(#grad5_top)" stroke="#bef264" stroke-width="6" />
    <!-- Conversion Arrow on Top Face -->
    <path d="M -120,-180 L 120,-180 M 70,-220 L 130,-180 L 70,-140" fill="none" stroke="#0f172a" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Left Face (Documents & Media) -->
    <polygon points="-312,-180 0,0 0,360 -312,180" fill="url(#grad5_left)" stroke="#38bdf8" stroke-width="6" />
    <!-- Downward Ingestion Arrow on Left Face -->
    <path d="M -156,-30 L -156,150 M -200,100 L -156,160 L -112,100" fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Right Face (Processed Output) -->
    <polygon points="0,0 312,-180 312,180 0,360" fill="url(#grad5_right)" stroke="#34d399" stroke-width="6" />
    <!-- Upward Export Arrow on Right Face -->
    <path d="M 156,150 L 156,-30 M 112,20 L 156,-40 L 200,20" fill="none" stroke="#bef264" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Center Isometric Nexus Joint -->
    <circle cx="0" cy="0" r="28" fill="#ffffff" filter="drop-shadow(0 0 16px #a3e635)" />
  </g>
</svg>'''

CONCEPTS = [
    ("concept_1_infinity_converter", SVG_1, "The Universal Möbius Infinity Loop"),
    ("concept_2_ac_monogram", SVG_2, "The Interlocking AC Tech Monogram"),
    ("concept_3_universal_orbit", SVG_3, "The 360° Universal Conversion Orbit"),
    ("concept_4_delta_arrow_a", SVG_4, "The Delta-Tech Supersonic A Converter"),
    ("concept_5_hexacore_engine", SVG_5, "The All-Formats Hexa-Core Cube Engine"),
]

# -------------------------------------------------------------
# RENDER TO TRANSPARENT PNG & FAVICONS VIA CHROME HEADLESS
# -------------------------------------------------------------
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(chrome_path):
    chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

print(f"Using browser engine: {chrome_path}")

for filename_base, svg_code, title in CONCEPTS:
    print(f"\nProcessing {title} ({filename_base})...")
    svg_path = os.path.join(OUTPUT_DIR, f"{filename_base}.svg")
    png_path = os.path.join(OUTPUT_DIR, f"{filename_base}.png")
    
    # 1. Save SVG
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_code)
    
    # 2. Render 1024x1024 Transparent PNG via Headless Chrome
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--default-background-color=00000000",
        "--window-size=1024,1024",
        f"--screenshot={png_path}",
        os.path.abspath(svg_path)
    ]
    res = subprocess.run(cmd, capture_output=True)
    if not os.path.exists(png_path) or os.path.getsize(png_path) == 0:
        print(f"Error rendering {filename_base}: {res.stderr.decode('utf-8', errors='ignore')}")
        continue
    
    # 3. Create Favicons and ICO via Pillow
    im = Image.open(png_path).convert("RGBA")
    
    # Save standard favicon sizes
    fav32 = im.resize((32, 32), Image.Resampling.LANCZOS)
    fav64 = im.resize((64, 64), Image.Resampling.LANCZOS)
    fav192 = im.resize((192, 192), Image.Resampling.LANCZOS)
    
    fav32.save(os.path.join(OUTPUT_DIR, f"{filename_base}_favicon_32.png"))
    fav64.save(os.path.join(OUTPUT_DIR, f"{filename_base}_favicon_64.png"))
    fav192.save(os.path.join(OUTPUT_DIR, f"{filename_base}_icon_192.png"))
    
    # Save .ico with 16, 32, 48, 64 sizes
    fav192.save(
        os.path.join(OUTPUT_DIR, f"{filename_base}.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    
    # 4. Copy 1024x1024 PNG to Brain Artifact directory for display
    brain_copy = os.path.join(BRAIN_DIR, f"{filename_base}.png")
    im.save(brain_copy)
    print(f"Saved: {png_path} + favicons + .ico")

print("\nAll 5 AllConverter Tech branding concepts successfully generated!")
