/**
 * Supabase Client / Storage Configuration (Optional)
 * 
 * Used when direct public bucket downloads or direct Supabase storage access is needed.
 * Primary API calls MUST continue routing through VITE_API_URL / API Gateway to ensure
 * unified gateway routing, authentication, and RBAC security checks remain intact.
 */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

/**
 * Returns a direct public URL for a file stored in a public Supabase Storage bucket.
 * @param {string} bucket - The Supabase storage bucket name (e.g. 'datasets', 'documents')
 * @param {string} path - The object key/path within the bucket
 * @returns {string} The public download URL
 */
export function getSupabasePublicUrl(bucket, path) {
  if (!SUPABASE_URL) return '';
  const cleanBase = SUPABASE_URL.replace(/\/+$/, '');
  const cleanPath = path ? path.replace(/^\/+/, '') : '';
  return `${cleanBase}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
