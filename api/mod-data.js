// This file will run on Vercel's serverless platform.
// It fetches version data for a list of mods from Modrinth and formats it
// to match the data structure your website expects.

const MODRINTH_SLUGS_URL = 'https://raw.githubusercontent.com/blockversemc/blockverse-mc/main/modrinth-slugs.json';
const MODRINTH_API = 'https://api.modrinth.com/v2/project/';

// Helper function to fetch and format version data for a single mod
async function fetchAndFormatModData(slug, postId, type) {
    try {
        // Fetch the project details (to get file names and platforms)
        const versionsRes = await fetch(`${MODRINTH_API}${slug}/version`);
        if (!versionsRes.ok) return [];

        const versions = await versionsRes.json();
        const formattedData = [];

        for (const version of versions) {
            // Modrinth API includes both game versions and loaders in the 'version' object
            const gameVersion = version.game_versions.join(', '); // e.g., "1.20.1, 1.20"

            for (const file of version.files) {
                if (!file.url) continue;

                // Modrinth platforms map roughly to our loaders/platforms
                for (const dependency of version.loaders) {
                    const loader = dependency.toLowerCase().replace('neoforge', 'neoforge'); // Standardize neoforge
                    
                    // Add an entry for each unique combination
                    formattedData.push({
                        PostID: postId,
                        Platform: 'java', // Assuming all Modrinth files are Java unless specified otherwise
                        Version: gameVersion,
                        Loader: loader,
                        Link: file.url,
                        Type: type
                    });
                }
            }
        }
        return formattedData;
    } catch (error) {
        console.error(`Error processing mod ${slug}:`, error.message);
        return [];
    }
}


// The main handler function for the Vercel API endpoint
export default async function handler(req, res) {
    
    // NOTE: Replace the GitHub URL below with your actual list URL!
    // Vercel function will pull this list from your GitHub repo every time it runs.
    const slugListUrl = 'https://raw.githubusercontent.com/blockversemc/blockverse-mc/main/modrinth-slugs.json'; 

    try {
        const listRes = await fetch(slugListUrl);
        if (!listRes.ok) {
             res.status(500).json({ error: "Failed to fetch mod list from GitHub." });
             return;
        }
        
        const modSlugs = await listRes.json();
        
        // Use Promise.all to fetch data for all mods concurrently (fast!)
        const allDataPromises = modSlugs.map(mod => 
            fetchAndFormatModData(mod.slug, mod.post_id, mod.type || 'mod')
        );
        
        const results = await Promise.all(allDataPromises);
        
        // Flatten the array of arrays into a single list of objects
        const finalData = results.flat();

        // Set caching headers so Vercel caches the response for up to 1 hour
        // This makes your website super fast and reduces function calls.
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); 

        // Send the formatted data back to the website
        res.status(200).json(finalData);

    } catch (error) {
        console.error("Global API Error:", error);
        res.status(500).json({ error: "An unexpected error occurred during data fetching." });
    }
}
