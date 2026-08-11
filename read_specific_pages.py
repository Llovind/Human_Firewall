import os
import pypdf

pdf_path = r"C:\Users\lovind\Downloads\1782957671260.pdf"
pages_to_extract = [8, 25, 43, 58]

def extract_specifics():
    if not os.path.exists(pdf_path):
        return

    reader = pypdf.PdfReader(pdf_path)
    for p_num in pages_to_extract:
        print(f"\n==================================================")
        print(f"=== HALAMAN {p_num} (Index {p_num - 1}) ===")
        print(f"==================================================")
        text = reader.pages[p_num - 1].extract_text()
        # Encode dengan ignore/replace agar tidak error di konsol Windows
        clean_text = text[:2000].encode('ascii', errors='replace').decode('ascii')
        print(clean_text)

if __name__ == "__main__":
    extract_specifics()
