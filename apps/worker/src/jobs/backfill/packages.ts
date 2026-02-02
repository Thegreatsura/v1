/**
 * Package List Fetching
 *
 * Fetches all package names from npm registry for backfill.
 * Uses the CouchDB _all_docs endpoint with pagination.
 */

interface AllDocsResponse {
  total_rows: number;
  offset: number;
  rows: Array<{ id: string }>;
}

const REGISTRY_URL = "https://replicate.npmjs.com/registry";
const PAGE_SIZE = 10000;

/**
 * Fetch all package names from npm registry using paginated _all_docs requests.
 * Calls onBatch for each page so processing can start immediately.
 */
export async function getAllPackages(
  onBatch?: (packages: string[], totalSoFar: number, estimatedTotal: number) => Promise<void>,
): Promise<string[]> {
  console.log("[Backfill] Fetching all package names from npm registry...");

  const allPackages: string[] = [];
  let startKey = "";
  let iteration = 0;
  let estimatedTotal = 0;

  while (true) {
    iteration++;

    // Build URL with pagination
    const url = startKey
      ? `${REGISTRY_URL}/_all_docs?limit=${PAGE_SIZE}&startkey="${encodeURIComponent(startKey)}"`
      : `${REGISTRY_URL}/_all_docs?limit=${PAGE_SIZE}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch all docs: ${response.status}`);
    }

    const data = (await response.json()) as AllDocsResponse;

    // First iteration - log total
    if (iteration === 1) {
      estimatedTotal = data.total_rows;
      console.log(`[Backfill] Registry has ${estimatedTotal.toLocaleString()} total packages`);
    }

    // Filter out design documents
    const pagePackages = data.rows.map((row) => row.id).filter((id) => !id.startsWith("_design/"));

    // Skip first item if we're continuing (it's the last item from previous page)
    if (startKey && pagePackages.length > 0 && pagePackages[0] === startKey) {
      pagePackages.shift();
    }

    allPackages.push(...pagePackages);

    // Call batch handler so processing can start immediately
    if (onBatch && pagePackages.length > 0) {
      await onBatch(pagePackages, allPackages.length, estimatedTotal);
    }

    // Log progress every 10 pages
    if (iteration % 10 === 0) {
      console.log(`[Backfill] Fetched ${allPackages.length.toLocaleString()} packages...`);
    }

    // Check if we've reached the end
    if (data.rows.length < PAGE_SIZE) {
      break;
    }

    // Set startkey for next page (last item's id)
    const lastRow = data.rows[data.rows.length - 1];
    if (!lastRow) break;
    startKey = lastRow.id;
  }

  console.log(`[Backfill] Total: ${allPackages.length.toLocaleString()} packages`);

  return allPackages;
}
