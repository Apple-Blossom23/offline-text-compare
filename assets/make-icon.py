"""Optional development helper: regenerate the app icon with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
image = Image.new('RGBA', (256, 256))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((2, 2, 254, 254), radius=61, fill='#4867e8')
draw.rounded_rectangle((59, 85, 198, 104), radius=9, fill='white')
draw.rounded_rectangle((59, 148, 198, 167), radius=9, fill='white')
draw.line((160, 49, 96, 205), fill='white', width=18)
image.save(root / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
