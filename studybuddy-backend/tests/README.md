# StudyBuddy API Tests

**Prerequisites:** Server running (`uvicorn main:app --reload`) and `.env` configured.

**Setup:** Create sample PDF:
```bash
python tests/create_sample_pdf.py
```

**Run order:** Run `test_student.py` first to get `student_id`, then update `STUDENT_ID` in other tests. For `test_upload`, use that ID and update `FILENAME`/`DOCUMENT_ID` in `test_notes` from the upload response.

```bash
python tests/test_student.py
python tests/test_upload.py      # uses STUDENT_ID
python tests/test_chat.py        # uses STUDENT_ID
python tests/test_notes.py       # uses STUDENT_ID, DOCUMENT_ID, FILENAME
python tests/test_memory.py      # uses STUDENT_ID
python tests/test_voice_tts.py   # independent
```
