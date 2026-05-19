// Shared auth helpers for the life-system worker.

/**
 * Validates a Bearer token in the Authorization header against an env secret.
 * Returns null if valid, or a Response object (401) if invalid.
 * Usage: const authError = checkBearerToken(request, env, "TRAINING_LOG_TOKEN");
 *        if (authError) return authError;
 */
export function checkBearerToken(request, env, secretName) {
  const expected = env[secretName];
  if (!expected) {
    return new Response(
      JSON.stringify({ success: false, error: `Server misconfigured: ${secretName} not set` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing or malformed Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (token !== expected) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
