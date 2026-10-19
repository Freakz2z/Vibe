self.onmessage = (event: MessageEvent<{ pattern: string; flags: string; text: string }>) => {
  try {
    const { pattern, flags, text } = event.data;
    const expression = new RegExp(pattern, flags);
    const matches: { text: string; index: number; groups: string[] }[] = [];
    let result: RegExpExecArray | null;
    while ((result = expression.exec(text)) && matches.length < 200) {
      matches.push({ text: result[0], index: result.index, groups: result.slice(1) });
      if (!expression.global && !expression.sticky) break;
      if (!result[0]) expression.lastIndex += 1;
    }
    self.postMessage({ matches });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '规则无法解析' }); }
};
self.postMessage({ ready: true });
export {};
