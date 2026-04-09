from fastapi import UploadFile
from PIL import Image
import os
import uuid
from datetime import datetime
import io


async def save_image(
    file: UploadFile,
    subfolder: str = "meals",
    max_size: tuple = (1200, 1200),
    quality: int = 85
) -> str:
    """
    Save an uploaded image as WebP format.
    
    Args:
        file: The uploaded file
        subfolder: "meals" or "progress"
        max_size: Maximum dimensions (width, height)
        quality: WebP quality (1-100)
    
    Returns:
        The path to the saved file
    """
    
    # Create directory if it doesn't exist
    upload_dir = f"uploads/{subfolder}"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{timestamp}_{unique_id}.webp"
    filepath = os.path.join(upload_dir, filename)
    
    # Read and process image
    contents = await file.read()
    
    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary (e.g., for PNG with transparency)
        if image.mode in ("RGBA", "P"):
            # Create white background
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "RGBA":
                background.paste(image, mask=image.split()[3])
            else:
                background.paste(image)
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")
        
        # Resize if too large (maintain aspect ratio)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save as WebP
        image.save(filepath, "WEBP", quality=quality, method=6)
        
        return filepath
        
    except Exception as e:
        # If image processing fails, try to save original
        # (but this shouldn't happen with valid images)
        raise Exception(f"Image processing failed: {str(e)}")


def delete_image(filepath: str) -> bool:
    """
    Delete an image file.
    
    Returns:
        True if deleted, False if file didn't exist
    """
    if filepath and os.path.exists(filepath):
        os.remove(filepath)
        return True
    return False


def get_image_size_mb(filepath: str) -> float:
    """Get image file size in MB."""
    if filepath and os.path.exists(filepath):
        return os.path.getsize(filepath) / (1024 * 1024)
    return 0.0
