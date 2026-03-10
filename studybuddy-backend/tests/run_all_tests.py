"""Run all StudyBuddy backend tests sequentially."""
import subprocess
import sys

python = sys.executable
tests = [
    ("Student Registration", "tests/test_student.py"),
    ("PDF Upload",           "tests/test_upload.py"),
    ("Chat",                 "tests/test_chat.py"),
    ("Memory/Greeting",      "tests/test_memory.py"),
    ("Notes Generation",     "tests/test_notes.py"),
    ("Voice TTS",            "tests/test_voice_tts.py"),
    ("End-to-End Full Flow", "tests/test_e2e.py"),
]

print("\n" + "="*60)
print("  StudyBuddy Backend - Running All Tests")
print("="*60 + "\n")

results = []
for name, path in tests:
    print(f">> Running: {name} ({path})")
    r = subprocess.run([python, path], capture_output=True, text=True, encoding="utf-8", errors="replace")
    output = r.stdout.strip() or r.stderr.strip()
    passed = "PASS" in output or "SUCCESS" in output or "END-TO-END TEST COMPLETE" in output
    status = "PASS" if passed else "FAIL"
    results.append((name, status, output))
    for line in output.splitlines()[-6:]:  # show last 6 lines
        print(f"   {line}")
    print()

print("="*60)
print("  RESULTS SUMMARY")
print("="*60)
for name, status, _ in results:
    icon = "[OK]" if status == "PASS" else "[XX]"
    print(f"  {icon}  {status}  |  {name}")

total_pass = sum(1 for _, s, _ in results if s == "PASS")
print(f"\n  {total_pass}/{len(results)} tests passed")
print("="*60 + "\n")
