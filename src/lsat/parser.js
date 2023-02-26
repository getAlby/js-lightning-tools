export const parseLsat = (string) => {
  // Remove double quotes around each value
  const unquotedString = string.replace(/="/g, '').replace(/"\s/g);
  
  // Split the string into key-value pairs
  const pairs = unquotedString.split(',');
  // Split each pair into key and value
  const keyValuePairArray = pairs.map(pair => {
    const [key, value] = pair.split('=').map(e => e.trim());
    return [key, value];
  });
  
  return Object.fromEntries(keyValuePairArray);
}