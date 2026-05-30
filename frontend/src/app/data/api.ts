const API_BASE_URL = import.meta.env.VITE_API_URL || (
  typeof window !== "undefined" && window.location.port === "5173"
    ? "http://127.0.0.1:4000/api/v1"
    : "/api/v1"
);


interface FetchOptions extends RequestInit {
  body?: any;
}

/**
 * Enterprise Native Fetch Client wrapper for communicating with vantage-backend.
 * Handles automatic JWT insertion and workspace tenant isolation headers.
 */
export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // 1. Compile request headers
  const headers = new Headers(options.headers || {});
  
  // Inject JSON content-type if body is provided
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Inject JWT authorization credential from localStorage
  const token = localStorage.getItem("vantage_token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Inject active workspace ID context for logical tenant isolation
  const workspaceId = localStorage.getItem("vantage_active_workspace_id");
  if (workspaceId) {
    headers.set("x-workspace-id", workspaceId);
  }

  // Cache-busting headers for critical state syncs
  headers.set("Cache-Control", "no-cache");
  headers.set("Pragma", "no-cache");

  // 2. Prepare payload body
  let serializedBody = options.body;
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    serializedBody = JSON.stringify(options.body);
  }

  const config: RequestInit = {
    ...options,
    headers,
    body: serializedBody,
  };

  try {
    const response = await fetch(url, config);

    // Parse JSON safely
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Handle session expiration
      if (response.status === 401 && !endpoint.includes("/auth")) {
        localStorage.removeItem("vantage_token");
        localStorage.removeItem("vantage_user");
        localStorage.removeItem("vantage_active_workspace_id");
        window.location.href = "/auth";
        // Return a dummy object and do not throw an error to prevent subsequent alert race conditions during page unload
        return { success: false, data: [] };
      }
      
      const errorMsg = (data && data.message) || `HTTP error! status: ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (error: any) {
    console.error(`🚨 API Fetch Exception [${endpoint}]:`, error);
    throw error;
  }
}
