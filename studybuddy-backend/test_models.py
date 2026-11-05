import joblib

p_rf = r'c:\Users\gowda\OneDrive\Desktop\Study_Buddy\StudyBudy\models\rf_model.pkl'
rf = joblib.load(p_rf)

print('Estimators in VotingClassifier:')
for name, est in rf.named_estimators_.items():
    print(name, '->', type(est))

test_texts = [
    'Can you explain FAFL Turing machines in advanced detail with proofs?',
    'I do not understand this concept at all, I am totally confused and stuck',
    'I understand the basics, let us continue with the next chapter on track'
]

for t in test_texts:
    try:
        pred = rf.predict([t])
        probs = rf.predict_proba([t])
        print(f'Text: "{t}" => Pred: {pred}, Probs: {probs}')
    except Exception as e:
        print(f'Error for "{t}": {e}')
