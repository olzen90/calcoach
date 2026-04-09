from fastapi import UploadFile
from PIL import Image
import os
import uuid
import httpx
from datetime import datetime
import io


def _process_image(contents: bytes, max_size: tuple = (1200, 1200), quality: int = 85) -> bytes:
    """Resize and convert image to WebP, returning raw bytes."""
    image = Image.open(io.BytesIO(contents))

    if image.mode in ("RGBA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "RGBA":
            background.paste(image, mask=image.split()[3])
        else:
            background.paste(image)
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    image.thumbnail(max_size, Image.Resampling.LANCZOS)

    output = io.BytesIO()
    image.save(output, "WEBP", quality=quality, method=6)
    return output.getvalue()


async def save_image(
    file: UploadFile,
    subfolder: str = "meals",
    max_size: tuple = (1200, 1200),
    quality: int = 85
) -> str:
    """
    Save an uploaded image. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
    otherwise falls back to local filesystem (for local development).

    Returns a public URL (Blob) or a relative path (local).
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{timestamp}_{unique_id}.webp"

    contents = await file.read()
    try:
        webp_bytes = _process_image(contents, max_size, quality)
    except Exception as e:
        raise Exception(f"Image processing failed: {str(e)}")

    blob_token = os.getenv("BLOB_READ_WRITE_TOKEN")

    if blob_token:
        pathname = f"calcoach/{subfolder}/{filename}"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"https://blob.vercel-storage.com/{pathname}",
                content=webp_bytes,
                headers={
                    "Authorization": f"Bearer {blob_token}",
                    "Content-Type": "image/webp",
                    "x-add-random-suffix": "0",
                },
            )
        if response.status_code not in (200, 201):
            raise Exception(f"Blob upload failed: {response.status_code} {response.text}")
        return response.json()["url"]

    # Local filesystem fallback
    upload_dir = f"uploads/{subfolder}"
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(webp_bytes)
    return filepath


async def delete_image(file_path_or_url: str) -> bool:
    """
    Delete an image from Vercel Blob (if URL) or local filesystem (if path).
    Returns True if deleted, False otherwise.
    """
    if not file_path_or_url:
        return False

    blob_token = os.getenv("BLOB_READ_WRITE_TOKEN")
    is_url = file_path_or_url.startswith("http://") or file_path_or_url.startswith("https://")

    if blob_token and is_url:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    "DELETE",
                    "https://blob.vercel-storage.com",
                    headers={
                        "Authorization": f"Bearer {blob_token}",
                        "Content-Type": "application/json",
                    },
                    json={"urls": [file_path_or_url]},
                )
            return response.status_code == 200
        except Exception:
            return False

    if not is_url and os.path.exists(file_path_or_url):
        os.remove(file_path_or_url)
        return True

    return False


def get_image_size_mb(file_path_or_url: str) -> float:
    """Get image size in MB. Only works for local files."""
    if file_path_or_url and not file_path_or_url.startswith("http") and os.path.exists(file_path_or_url):
        return os.path.getsize(file_path_or_url) / (1024 * 1024)
    return 0.0
