import os
import re
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

BASE_URL = "https://www.jpml.uscourts.gov"
LIST_URL = BASE_URL + "/pending-mdl-statistics-0"
PDF_DIR = os.path.join("..", "data", "pdfs")
os.makedirs(PDF_DIR, exist_ok=True)

def fetch_pdf_links():
    resp = requests.get(LIST_URL)
    soup = BeautifulSoup(resp.text, "html.parser")
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.search(r"Pending_MDL_Dockets_By_Docket_Type-.*\\.pdf", href):
            if not href.startswith("http"):
                href = BASE_URL + href
            links.append(href)
    return links

def download_pdfs():
    links = fetch_pdf_links()
    for url in tqdm(links, desc="Downloading PDFs"):
        fname = url.split("/")[-1]
        out_path = os.path.join(PDF_DIR, fname)
        if not os.path.exists(out_path):
            r = requests.get(url)
            with open(out_path, "wb") as f:
                f.write(r.content)
        else:
            tqdm.write(f"Already have {fname}")

if __name__ == "__main__":
    download_pdfs()
