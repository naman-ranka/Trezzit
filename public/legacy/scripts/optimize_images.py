
import os
from PIL import Image

def optimize_image(input_path, output_path=None, max_width=None, format='WEBP', quality=85):
    """
    Optimizes an image by resizing and converting formatting.
    """
    try:
        if not os.path.exists(input_path):
            print(f"Error: File not found: {input_path}")
            return

        with Image.open(input_path) as img:
            # Resize if max_width is specified and image is larger
            if max_width and img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                print(f"Resized {input_path} to {max_width}x{new_height}")

            # Save
            if output_path is None:
                base, _ = os.path.splitext(input_path)
                output_path = f"{base}.{format.lower()}"
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            img.save(output_path, format=format, quality=quality)
            print(f"Saved optimized image to {output_path}")

    except Exception as e:
        print(f"Failed to optimize {input_path}: {e}")

if __name__ == "__main__":
    # Define images to process
    base_dir = r"c:\Users\naman\Desktop\Projects\TrezzitFrontend\trezzit-landing-page\public\assets"
    
    images_to_process = [
        {
            "path": os.path.join(base_dir, "images", "dashboard-preview.jpg"),
            "max_width": 600,
            "format": "WEBP"
        },
        {
            "path": os.path.join(base_dir, "icons", "trezzit-icon-square.png"),
            "max_width": 240,
            "format": "WEBP"
        }
    ]

    for img_info in images_to_process:
        optimize_image(img_info["path"], max_width=img_info.get("max_width"), format=img_info.get("format"))
