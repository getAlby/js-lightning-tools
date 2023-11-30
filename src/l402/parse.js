export const parseL402 = (string) => {
  // Remove the L402 and LSAT identifiers
  string = string.replace("L402", "").replace("LSAT", "").trim();

  // Initialize an object to store the key-value pairs
  const keyValuePairs = {};

  // Regular expression to match key and (quoted or unquoted) value
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|([^,]*))/g;
  let match;

  // Use regex to find all key-value pairs
  while ((match = regex.exec(string)) !== null) {
    // Key is always match[1]
    // Value is either match[3] (double-quoted), match[4] (single-quoted), or match[5] (unquoted)
    keyValuePairs[match[1]] = match[3] || match[4] || match[5];
  }

  return keyValuePairs;
};
