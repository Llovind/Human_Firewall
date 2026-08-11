import os
import pypdf

pdf_path = r"C:\Users\lovind\Downloads\1782957671260.pdf"
keywords = ["phishing", "behavior", "perilaku", "gamifikasi", "gamification", "soc", "awareness", "chatbot"]

def search_keywords():
    if not os.path.exists(pdf_path):
        print("PDF file not found.")
        return

    reader = pypdf.PdfReader(pdf_path)
    results = {kw: [] for kw in keywords}

    for i in range(len(reader.pages)):
        text = reader.pages[i].extract_text()
        if not text:
            continue
        text_lower = text.lower()
        for kw in keywords:
            # Cari keyword di halaman ini
            if kw in text_lower:
                results[kw].append(i + 1)

    print("=== HASIL PEMINDAIAN KATA KUNCI ===")
    for kw, pages in results.items():
        print(f"Kata kunci '{kw}' ditemukan di halaman: {pages}")

    # Ambil kutipan atau detail khusus pada halaman artikel utama yang relevan
    # 1. Halaman 30 (LLM Chatbot Testing Guide)
    print("\n=== RELEVANSI ARTIKEL HALAMAN 30 (Chatbot Testing) ===")
    p30_text = reader.pages[29].extract_text() # Page 30 is index 29
    print(p30_text[:1200].replace('\n', ' '))

    # 2. Halaman 49 (SOC Threat Hunting)
    print("\n=== RELEVANSI ARTIKEL HALAMAN 49 (SOC Threat Hunting) ===")
    p49_text = reader.pages[48].extract_text() # Page 49 is index 48
    print(p49_text[:1200].replace('\n', ' '))

if __name__ == "__main__":
    search_keywords()
