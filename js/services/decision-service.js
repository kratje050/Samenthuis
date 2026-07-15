export function availableChoices(wheel) { return (wheel.choices || []).filter((choice) => choice.text && !choice.excluded); }

export function pickDecision(wheel, random = Math.random) {
  const choices = availableChoices(wheel);
  if (!choices.length) throw new Error('Voeg minimaal één beschikbare keuze toe.');
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
