import { parsePhoneNumberFromString } from "libphonenumber-js/max";

function placeholder(number) {
  if (/^(\d)\1{5,}$/.test(number)) return true;
  for (let size = 2; size <= 4; size++) {
    if (
      number.length >= size * 3 &&
      number.length % size === 0 &&
      number === number.slice(0, size).repeat(number.length / size)
    )
      return true;
  }
  return ["01234567890123456789", "98765432109876543210"].some(
    (sequence) => number.length >= 7 && sequence.includes(number),
  );
}

export function validatePhone(value) {
  const invalid = (code, message) => ({ valid: false, code, message });
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !/^\+?[0-9\s().-]+$/.test(value.trim())
  )
    return invalid(
      "format",
      "Укажите номер телефона цифрами, без букв и добавочного номера.",
    );
  try {
    const input = value.trim();
    // A number without an international + is treated as Russian national input.
    // libphonenumber-js converts 8…, 7… and the 10-digit local form to +7….
    const phone = parsePhoneNumberFromString(input, {
      ...(input.startsWith("+") ? {} : { defaultCountry: "RU" }),
      extract: false,
    });
    if (!phone?.isValid() || phone.ext)
      return invalid(
        "numbering_plan",
        "Проверьте код страны, количество цифр и сам номер.",
      );
    // A local anti-placeholder rule, not evidence that a subscriber does not exist.
    if (placeholder(phone.nationalNumber))
      return invalid(
        "placeholder",
        "Номер похож на заглушку: одинаковые цифры или повторяющаяся последовательность. Укажите другой контакт.",
      );
    return {
      valid: true,
      normalized: phone.number,
      formatted: phone.formatInternational(),
      country: phone.country || null,
      type: phone.getType() || null,
    };
  } catch {
    return invalid(
      "format",
      "Не удалось разобрать номер. Проверьте международный формат.",
    );
  }
}
