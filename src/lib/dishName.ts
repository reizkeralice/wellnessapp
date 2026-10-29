const VARIANT_SUFFIX = /\s*(?:\(\s*)?вариант\s+\d+\s*\)?\s*$/iu;
const REPEATABLE_WORDS = new Set(['и', 'с', 'со', 'в', 'во', 'на', 'по', 'из', 'для', 'без', 'или', 'до', 'к', 'от', 'о', 'об', 'у']);

function sentenceCase(value: string): string {
  const normalized = value.toLocaleLowerCase('ru-RU');
  return normalized.replace(/^(\s*[\p{P}\p{S}]*\s*)([a-zа-яё])/iu, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toLocaleUpperCase('ru-RU')}`,
  );
}

export function cleanDishName(value: string): string {
  const withoutVariant = value.replace(VARIANT_SUFFIX, '').trim();
  const uniqueSegments = new Set<string>();
  const uniqueWords = new Set<string>();
  const withoutRepeatedSegments = withoutVariant
    .split(/([(),;])/)
    .map((part) => {
      if (/^[(),;]$/.test(part)) return part;
      const words = part.trim().split(/\s+/).filter(Boolean);
      const withoutRepeatedWords = words.filter((word) => {
        const key = word.toLocaleLowerCase('ru-RU');
        if (REPEATABLE_WORDS.has(key)) return true;
        if (uniqueWords.has(key)) return false;
        uniqueWords.add(key);
        return true;
      });
      const segment = withoutRepeatedWords.join(' ');
      if (!segment) return '';
      const key = segment.toLocaleLowerCase('ru-RU');
      if (uniqueSegments.has(key)) return '';
      uniqueSegments.add(key);
      return segment;
    })
    .join('')
    .replace(/\s+([,;)])/g, '$1')
    .replace(/,\s*\)/g, ')')
    .replace(/([(])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\(/g, ' (')
    .replace(/\s+\)/g, ')')
    .replace(/([^\s(])\(/g, '$1 (')
    .replace(/,\s*\)/g, ')')
    .trim();

  return sentenceCase(withoutRepeatedSegments);
}

const LACTOSE_INGREDIENT = /молок|сливк|творог|йогурт|кефир|сметан|сыворот|морожен|сгущ[её]н|сыр|масло сливоч|milk|cream|yogurt|yoghurt|cheese|whey|butter/i;
const LACTOSE_FREE = /безлактоз|без лактоз|лактозы нет|lactose[- ]free/i;

export function containsLactoseIngredient(names: string[]): boolean {
  return names.some((name) => !LACTOSE_FREE.test(name) && LACTOSE_INGREDIENT.test(name));
}
