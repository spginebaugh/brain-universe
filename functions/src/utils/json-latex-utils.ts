/**
 * Utility functions for handling LaTeX content in JSON
 */

/**
 * Escapes LaTeX content for safe inclusion in JSON strings
 * Double escapes all backslashes and handles other special characters
 *
 * @param input - The string containing LaTeX content to be escaped
 * @returns The escaped string safe for JSON inclusion
 */
export function escapeLatexForJson(input: string): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  // Double escape all backslashes for JSON
  // This handles LaTeX commands like \text{}, \frac{}{}, etc.
  return input.replace(/\\/g, "\\\\");
}

/**
 * Safely parses JSON that may contain LaTeX content
 * Attempts recovery if standard parsing fails
 *
 * @param jsonString - The JSON string to parse
 * @returns The parsed object or a fallback object if parsing fails
 */
export function safeJsonParse(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON parsing error:", error);

    try {
      // Try to fix common LaTeX issues by escaping unescaped backslashes
      const fixedJson = jsonString
        .replace(/\\([^\\"])/g, "\\\\$1"); // Double escape backslashes except when already escaped

      return JSON.parse(fixedJson);
    } catch (secondError) {
      console.error("Could not fix JSON:", secondError);
      // Return a valid but empty default object with error info
      return {
        error: "JSON parsing failed",
        originalError: error instanceof Error ? error.message : String(error),
        partial: true,
      };
    }
  }
}

/**
 * Pre-processes an object before JSON stringification to ensure LaTeX content is properly escaped
 * Recursively processes all string properties in the object
 *
 * @param obj - The object to process
 * @returns The processed object with LaTeX content properly escaped
 */
export function preprocessLatexInObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return escapeLatexForJson(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => preprocessLatexInObject(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = preprocessLatexInObject(obj[key]);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Safely stringifies an object that may contain LaTeX content
 * Pre-processes the object to ensure all LaTeX content is properly escaped
 *
 * @param obj - The object to stringify
 * @returns The JSON string with properly escaped LaTeX content
 */
export function safeJsonStringify(obj: any): string {
  const processedObj = preprocessLatexInObject(obj);
  return JSON.stringify(processedObj);
}
