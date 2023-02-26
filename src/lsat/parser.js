export const parseLsat = (string) => {
  // Split the string into key-value pairs
  const pairs = unquotedString.split(',');
  
  // Split each pair into key and value
  const keyValuePairArray = pairs.map(pair => {
    const [key, valuePotentiallyQuoted] = pair.split('=').map(e => e.trim());
    const valueMatch = valuePotentiallyQuoted.match(/"?([^"]*)"?/);
    const valye = valueMatch[1]
    return [key, value];
  });
  
  return Object.fromEntries(keyValuePairArray);
}