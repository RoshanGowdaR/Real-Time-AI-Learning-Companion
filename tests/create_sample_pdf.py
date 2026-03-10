"""Create sample.pdf with extractable text. Run once before tests."""
import os
import fitz

script_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(script_dir, "sample.pdf")
doc = fitz.open()
page = doc.new_page()
page.insert_text((72, 72), "This is a sample PDF for StudyBuddy tests. It contains extractable text.")
doc.save(path)
doc.close()
print(f"Created {path}")
