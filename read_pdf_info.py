import os

pdf_path = r"C:\Users\lovind\Downloads\1782957671260.pdf"

def read_pdf():
    # Coba beberapa library PDF yang mungkin terinstal
    methods = []
    
    # Method 1: pypdf
    try:
        import pypdf
        def read_pypdf(path):
            reader = pypdf.PdfReader(path)
            title = reader.metadata.title if reader.metadata else "Unknown"
            print(f"--- [pypdf] Title: {title}, Pages: {len(reader.pages)} ---")
            print(reader.pages[0].extract_text()[:2000])
        methods.append(read_pypdf)
    except ImportError:
        pass

    # Method 2: PyPDF2
    try:
        import PyPDF2
        def read_pypdf2(path):
            reader = PyPDF2.PdfReader(path)
            title = reader.metadata.title if reader.metadata else "Unknown"
            print(f"--- [PyPDF2] Title: {title}, Pages: {len(reader.pages)} ---")
            print(reader.pages[0].extract_text()[:2000])
        methods.append(read_pypdf2)
    except ImportError:
        pass

    # Method 3: fitz (PyMuPDF)
    try:
        import fitz
        def read_fitz(path):
            doc = fitz.open(path)
            print(f"--- [PyMuPDF/fitz] Title: {doc.metadata.get('title', 'Unknown')}, Pages: {len(doc)} ---")
            print(doc[0].get_text()[:2000])
        methods.append(read_fitz)
    except ImportError:
        pass

    if not methods:
        print("Tidak ada library PDF (pypdf, PyPDF2, atau fitz) yang terinstal di Python host.")
        return

    # Jalankan method pertama yang sukses di-import
    try:
        methods[0](pdf_path)
    except Exception as e:
        print(f"Gagal membaca PDF: {e}")

if __name__ == "__main__":
    if os.path.exists(pdf_path):
        read_pdf()
    else:
        print(f"File tidak ditemukan di: {pdf_path}")
