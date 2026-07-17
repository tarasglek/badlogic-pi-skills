function removeBooleanFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function removeValueFlag(args, flag, defaultValue, transform) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1]) return defaultValue;
  const value = transform(args[index + 1]);
  args.splice(index, 2);
  return value;
}

export function parseSearchArgs(args) {
  const remaining = [...args];
  const fetchContent = removeBooleanFlag(remaining, "--content");
  const numResults = removeValueFlag(
    remaining,
    "-n",
    5,
    (value) => Number.parseInt(value, 10),
  );
  const country = removeValueFlag(
    remaining,
    "--country",
    "US",
    (value) => value.toUpperCase(),
  );
  const freshness = removeValueFlag(
    remaining,
    "--freshness",
    null,
    String,
  );

  return {
    query: remaining.join(" "),
    fetchContent,
    numResults,
    country,
    freshness,
  };
}

export function formatResults(results) {
  return results.map((result, index) => {
    const lines = [
      `--- Result ${index + 1} ---`,
      `Title: ${result.title}`,
      `Link: ${result.link}`,
    ];
    if (result.age) lines.push(`Age: ${result.age}`);
    lines.push(`Snippet: ${result.snippet}`);
    if (result.content) lines.push(`Content:\n${result.content}`);
    return lines.join("\n");
  }).join("\n\n") + "\n";
}
