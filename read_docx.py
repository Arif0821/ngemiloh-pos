import zipfile
import xml.etree.ElementTree as ET
import sys

def extract_text_from_docx(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            # XML namespace for WordprocessingML
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text = []
            for paragraph in tree.iterfind('.//w:p', ns):
                para_text = []
                for run in paragraph.iterfind('.//w:r', ns):
                    for text_node in run.iterfind('.//w:t', ns):
                        para_text.append(text_node.text or '')
                if para_text:
                    text.append(''.join(para_text))
                else:
                    text.append('') # Empty line for paragraph breaks
            return '\n'.join(text)
    except Exception as e:
        return f"Error: {e}"

if __name__ == '__main__':
    text = extract_text_from_docx(sys.argv[1])
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        f.write(text)
