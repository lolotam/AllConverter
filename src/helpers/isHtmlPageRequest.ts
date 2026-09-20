export function isHtmlPageRequest(request: Request): boolean {
  const acceptsHtml = request.headers.get("accept")?.toLowerCase().includes("text/html");
  // A download link ("<a download>") is a navigation but asks for */*, so without
  // this it would receive a JSON 401 instead of being sent to the login page
  const isNavigation = request.headers.get("sec-fetch-mode") === "navigate";
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    (Boolean(acceptsHtml) || isNavigation)
  );
}
