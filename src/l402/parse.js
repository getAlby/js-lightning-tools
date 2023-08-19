export const parseL402 = (string) => {
  string = string.replace("L402", "");
  string = string.replace("LSAT", "");
  // Split the string into key-value pairs
  const pairs = string.split(",");

  // Split each pair into key and value
  const keyValuePairArray = pairs.map((pair) => {
    const [key, valuePotentiallyQuoted] = pair.split("=").map((e) => e.trim());
    const valueMatch = valuePotentiallyQuoted.match(/"?([^"]*)"?/);
    const value = valueMatch[1];
    return [key, value];
  });

  return Object.fromEntries(keyValuePairArray);
};
