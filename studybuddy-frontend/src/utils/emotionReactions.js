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
  happy: [
    'Love the energy {name}! This is when the best learning happens.',
    'You are in the zone {name}! Keep going, you are crushing it.',
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
