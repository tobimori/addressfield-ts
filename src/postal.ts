export const compilePostalCode = (pattern: string) => {
  const regex = new RegExp(`^(?:${pattern})$`, "iu");

  // compare the full match because $ can also match before a final newline
  return (value: string) => regex.exec(value)?.[0] === value;
};
