import re, os

def clean_html(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # very simple html to text
        text = re.sub(r'<[^>]+>', ' ', content)
        text = re.sub(r'\s+', ' ', text).strip()
        print(f"--- {filepath} ---")
        print(text[:3000])
        print("\n\n")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

docs = [
    r"C:\Users\agaul\.gemini\antigravity\brain\746f4ea2-825c-44cf-a31a-c4b751b15f30\.system_generated\steps\584\content.md",
    r"C:\Users\agaul\.gemini\antigravity\brain\746f4ea2-825c-44cf-a31a-c4b751b15f30\.system_generated\steps\590\content.md",
    r"C:\Users\agaul\.gemini\antigravity\brain\746f4ea2-825c-44cf-a31a-c4b751b15f30\.system_generated\steps\600\content.md"
]

for doc in docs:
    clean_html(doc)
