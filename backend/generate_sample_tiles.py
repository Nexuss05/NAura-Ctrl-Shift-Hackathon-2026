import os
import numpy as np

try:
    import rasterio
    from rasterio.transform import from_origin
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


def generate_mock_tiff_files():
    """
    Genera file TIFF fittizi con coordinate geografiche e bande RED/NIR reali 
    per permettere al calcolatore NDVI di dimostrare il parsing raster.
    """
    data_dir = "backend/data"
    os.makedirs(data_dir, exist_ok=True)

    if not RASTERIO_AVAILABLE:
        print("[TIFF Generator] rasterio is not installed. Skipping actual TIFF write, using calculator's synthetic numpy fallback.")
        return

    # Maremma test coordinate (Grosseto, Italy)
    # 42.716 N, 11.114 E
    projects = ["project-maremma", "project-kenya", "project-amazon"]
    
    for proj in projects:
        # 100x100 pixel
        width = 100
        height = 100
        
        # Coordinate geografiche fittizie
        transform = from_origin(11.11, 42.72, 10, 10) # 10m di risoluzione pixel
        
        # Genera dati RED (Banda 4) e NIR (Banda 8)
        # NDVI atteso intorno a 0.50 (Vegetazione rigogliosa)
        # RED: Assorbimento alto (valori bassi 200 - 800)
        # NIR: Riflessione alta (valori alti 2500 - 4500)
        red_data = np.random.randint(200, 800, size=(height, width)).astype(np.uint16)
        nir_data = np.random.randint(2500, 4500, size=(height, width)).astype(np.uint16)
        
        # Scrive RED TIFF
        b04_path = f"{data_dir}/{proj}_b04_after.tif"
        with rasterio.open(
            b04_path, 'w',
            driver='GTiff',
            height=height, width=width,
            count=1,
            dtype=rasterio.uint16,
            crs='+proj=latlong',
            transform=transform
        ) as dst:
            dst.write(red_data, 1)
            
        # Scrive NIR TIFF
        b08_path = f"{data_dir}/{proj}_b08_after.tif"
        with rasterio.open(
            b08_path, 'w',
            driver='GTiff',
            height=height, width=width,
            count=1,
            dtype=rasterio.uint16,
            crs='+proj=latlong',
            transform=transform
        ) as dst:
            dst.write(nir_data, 1)

    print(f"[TIFF Generator] Generated sample Sentinel-2 spectral TIFF files in {data_dir}/ successfully.")


if __name__ == "__main__":
    generate_mock_tiff_files()
