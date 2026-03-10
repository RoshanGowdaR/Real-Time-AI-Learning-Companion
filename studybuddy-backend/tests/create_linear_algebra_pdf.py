"""Creates a 50-word Linear Algebra test PDF for end-to-end testing."""
import os
import fitz  # PyMuPDF

script_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(script_dir, "linear_algebra.pdf")

content = """Linear Algebra Study Notes - Chapter 1

Key Topics for Exam:
1. Matrix Multiplication: Rows of first matrix times columns of second.
2. Determinants: For 2x2 matrix [a,b;c,d], det = ad - bc.
3. Eigenvalues: Solve det(A - lambda*I) = 0 to find eigenvalues.
4. Row Echelon Form: Used to solve systems of linear equations.
5. Dot Product: Sum of products of corresponding vector components.

Focus Areas for 5-Mark Questions:
- Properties of matrices (rank, nullity, transpose)
- Solving systems using Gaussian elimination
- Finding eigenvalues and eigenvectors
"""

doc = fitz.open()
page = doc.new_page()
page.insert_text((72, 72), content, fontsize=11)
doc.save(path)
doc.close()
print(f"Created linear_algebra.pdf at {path}")
print(f"Word count: ~{len(content.split())} words")
