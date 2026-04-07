
const extractQueryIntent = (text) => {
    if (!text) return { yearOfStudy: null, keywords: [], cgpaCriteria: null, placementWillingness: null };

    // 1. Normalize input
    let normalized = text.toLowerCase().trim();
    let yearOfStudy = null;
    let cgpaCriteria = null;
    let placementWillingness = null;

    // 2. GREEDY CGPA Detection (Covers 'above 8', '8.1 cgpa', '> 7.5', 'cgpa 8.2', etc.)
    // IMPROVEMENT: Handle 'cgpaabove8.0' without spaces.
    const aboveCgpaRegex = /(?:above|more than|greater than|>|>=|above c\.?g\.?p\.?a\.?|cgpa\s*above|cgpaabove)\s*(\d+(\.\d+)?)|(\d+(\.\d+)?)\s*(?:c\.?g\.?p\.?a\.?|grade|score)/i;
    const belowCgpaRegex = /(?:below|less than|smaller than|<|<=|cgpabelow|cgpa\s*below)\s*(\d+(\.\d+)?)/i;
    
    const aboveMatch = normalized.match(aboveCgpaRegex);
    const belowMatch = normalized.match(belowCgpaRegex);

    if (aboveMatch) {
        const val = parseFloat(aboveMatch[1] || aboveMatch[3]);
        if (!isNaN(val)) {
            cgpaCriteria = { $gte: val };
            normalized = normalized.replace(aboveMatch[0], ' ');
        }
    } else if (belowMatch) {
        const val = parseFloat(belowMatch[1]);
        if (!isNaN(val)) {
            cgpaCriteria = { $lte: val };
            normalized = normalized.replace(belowMatch[0], ' ');
        }
    } else {
        // Standalone number detection for CGPA candidates (e.g., "with 8.5")
        const plainNumberMatch = normalized.match(/\b([56789](\.\d+)?)\b/);
        if (plainNumberMatch) {
            const val = parseFloat(plainNumberMatch[1]);
            cgpaCriteria = { $gte: val };
            normalized = normalized.replace(plainNumberMatch[0], ' ');
        }
    }

    // 3. Year Detection
    const yearMatch = normalized.match(/(\d)(?:st|nd|rd|th)?\s*year/i);
    if (yearMatch) {
        yearOfStudy = parseInt(yearMatch[1]);
        normalized = normalized.replace(yearMatch[0], ' ');
    } else {
        const yearMappers = {
            'first year': 1, 'second year': 2, 'third year': 3, 'fourth year': 4, 'final year': 4
        };
        for (const [phrase, year] of Object.entries(yearMappers)) {
            if (normalized.includes(phrase)) {
                yearOfStudy = year;
                normalized = normalized.replace(phrase, ' ');
                break;
            }
        }
    }

    // 4. Placement Intent
    if (normalized.match(/placement ready|placed|ready for placement|willing for placement/i)) {
        placementWillingness = 'yes';
        normalized = normalized.replace(/placement ready|placed|ready for placement|willing for placement/i, ' ');
    }

    // 5. Keyword Extraction (Remaining words)
    const fillerWords = [
        "students", "student", "who", "with", "and", "the", "in", "like", "for", 
        "matching", "having", "is", "are", "cgpa", "year", "placement", "willing", 
        "ready", "skill", "skills", "knowing", "above", "below", "more", "than", "greater", "less", "of", "all"
    ];
    
    const keywords = normalized.split(/[\s,]+/)
        .map(word => word.trim())
        .filter(word => word.length > 1 && !fillerWords.includes(word));

    return { 
        yearOfStudy, 
        keywords, 
        cgpaCriteria,
        placementWillingness,
        normalizedQuery: normalized // returned for debugging
    };
};

const testQueries = [
    "cgpaabove8.0 in 3rd year",
    "students above 8.5 cgpa in 4th year",
    "cgpa below 7.0 in 2nd year",
    "placed students in 4th year with cgpa above 8",
    "javascript developers in final year"
];

testQueries.forEach(q => {
    console.log(`\nQUERY: ${q}`);
    console.log(JSON.stringify(extractQueryIntent(q), null, 2));
});
