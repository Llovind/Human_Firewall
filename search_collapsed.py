import os
import pypdf

pdf_path = r"C:\Users\lovind\Downloads\1782957671260.pdf"
keywords = ["phishing", "behavior", "perilaku", "gamifikasi", "gamification", "soc", "awareness", "chatbot"]

def search_collapsed():
    if not os.path.exists(pdf_path):
        print("PDF not found.")
        return

    reader = pypdf.PdfReader(pdf_path)
    results = {kw: [] for kw in keywords}

    for i in range(len(reader.pages)):
        text = reader.pages[i].extract_text()
        if not text:
            continue
        # Hapus spasi dan baris baru secara total untuk pencarian kata
        text_collapsed = "".join(text.split()).lower()
        
        for kw in keywords:
            if kw in text_collapsed:
                results[kw].append(i + 1)

    print("=== HASIL PEMINDAIAN ULANG (COLLAPSED SPACES) ===")
    for kw, pages in results.items():
        print(f"Kata kunci '{kw}' ditemukan di halaman: {pages}")

    # Mari kita cari artikel tentang "Behavioral Analysis" atau "SOC" atau "LLM Chatbot"
    # Dari Table of Contents sebelumnya:
    # Page 26: Tantangan Keamanan di Era Agentic AI (Index 25)
    # Page 30: Pengujian Chatbot Berbasis LLM (Index 29)
    # Page 49: Mengapa SOC Tetap Harus Threat Hunting (Index 48)
    
    print("\n=== KONTEN DETAIL HALAMAN 26 (Agentic AI - Index 25) ===")
    print(reader.pages[25].extract_text()[:1500])

    print("\n=== KONTEN DETAIL HALAMAN 30 (Chatbot Testing - Index 29) ===")
    print(reader.pages[29].extract_text()[:1500])

    print("\n=== KONTEN DETAIL HALAMAN 49 (Threat Hunting - Index 48) ===")
    print(reader.pages[48].extract_text()[:1500])

if __name__ == "__main__":
    search_collapsed()
