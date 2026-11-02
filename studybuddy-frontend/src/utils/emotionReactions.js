const emotionResponses = {
  confused: [
    'Hey {name}, you look a bit confused. Want me to explain that again more simply?',
    'Hmm, something not clicking {name}? Let me try a different way to explain this.',
    'That topic can be tricky {name}. Should I break it down step by step?',
  ],
  distressed: [
    'Hey {name}, take a breath. You are doing better than you think. Want a 2 minute break?',
    'I can see you are stressed {name}. That is okay. Hard topics take time. You have got this!',
    'Stress means your brain is working hard, {name}. Proud of you for pushing through. Need a simpler version?',
  ],
  bored: [
    'Seems like you need a change of pace {name}! Want quick flashcards instead?',
    'Hey {name}, still with me? Let us make this fun. Want a challenge question?',
    'Energy dropping, {name}? 5 minute break, then we come back stronger. Sound good?',
  ],
  no_face: [
    'Hey {name}, where did you go? Come back, we were on a roll!',
    '{name}, the notes will not study themselves. I am waiting!',
    'I will be right here when you get back {name}. Do not take too long!',
  ],
  sleeping: [
    'Hey {name}, wake up! Time to get back to studying!',
    '{name}, dozing off? Take a quick stretch or splash some water on your face!',
    'Wake up {name}! Let us stay focused and finish this topic together!',
  ],
  drowsy: [
    'Feeling sleepy, {name}? Take a deep breath and let us refocus!',
    'Hey {name}, do a quick stretch or grab some water—stay with me!',
  ],
  happy: [
    'Love the energy {name}! This is when the best learning happens.',
    'You are in the zone {name}! Keep going, you are crushing it.',
  ],
  sad: [
    'Hang in there {name}! Learning complex topics is tough, but you are making real progress.',
    'Hey {name}, take it easy on yourself. We can take this topic one small piece at a time.',
  ],
  angry: [
    'Take a deep breath {name}. It is completely normal to feel frustrated by tough problems.',
    'Hey {name}, let us slow down and untangle this step by step. You have got this!',
  ],
  fear: [
    'No need to stress {name}! Exams and tough questions are conquerable with practice.',
    'Take a steady breath {name}. Let us break this down so it feels effortless.',
  ],
  disgust: [
    'Topic feeling tedious {name}? Let us switch angles and make it interesting!',
    'Hey {name}, let us try an intuitive real-world analogy to make this fun.',
  ],
  surprise: [
    'Surprising concept {name}? That is the spark of curiosity! Let us dive into why that happens.',
    'Aha moment {name}! Let us explore what makes this work behind the scenes.',
  ],
}

export function getEmotionResponse(emotion, studentName) {
  const normalized = String(emotion || '').trim().toLowerCase()
  if (!normalized || normalized === 'neutral') {
    return null
  }

  const options = emotionResponses[normalized]
  if (!Array.isArray(options) || options.length === 0) {
    return null
  }

  const name = String(studentName || 'there').trim() || 'there'
  const index = Math.floor(Math.random() * options.length)
  return options[index].replace(/\{name\}/g, name)
}

export { emotionResponses }
